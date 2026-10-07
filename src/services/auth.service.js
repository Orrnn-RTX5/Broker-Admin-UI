import { api } from '../lib/api.js';
import { expireAuthSession, useAuthStore } from '../store/authStore.js';
import { clearBrokerInfo } from './brokerAuth.js';
import { buildUserFromAuthPayload } from '../utils/sessionUser.js';
import { buildDisconnectRequest } from '../utils/serviceContracts.js';

const notifyBackendDisconnect = async (token) => {
  if (!token) return;

  try {
    const request = buildDisconnectRequest(token);
    await api.get(request.url, request.config);
  } catch {
    // Logout must still clear local state if the backend session is slow or gone.
  }
};

let accessRequestSequence = 0;
let startupAccessRequest;
useAuthStore.subscribe((state, previous) => {
  if (!state.isAuthenticated || state.accessToken !== previous.accessToken) startupAccessRequest = undefined;
});
const currentStartupAccess = () => startupAccessRequest
  && startupAccessRequest.token === useAuthStore.getState().accessToken
  && startupAccessRequest.sequence === accessRequestSequence
  && Date.now() - startupAccessRequest.startedAt < 5000;
export const AuthService = {
  primeStartupMe: () => {
    if (currentStartupAccess()) return startupAccessRequest.promise;
    const token = useAuthStore.getState().accessToken;
    const promise = AuthService.getMe();
    startupAccessRequest = { token, promise, sequence: accessRequestSequence, startedAt: Date.now() };
    promise.catch(() => {});
    return promise;
  },
  // Only the initial shell hydration shares this early request. Focus, access
  // events and later polls still start fresh reads and supersede old snapshots.
  getStartupMe: () => currentStartupAccess() ? startupAccessRequest.promise : AuthService.primeStartupMe(),
  getMe: async () => {
    const token=useAuthStore.getState().accessToken;
    const sequence=++accessRequestSequence;
    try {
      const response = await api.get('/manager/api/v2/auth/me', { _allowAuthFailure: true, timeout: 5000 });
      const user = buildUserFromAuthPayload(response.data);
      if(sequence===accessRequestSequence && useAuthStore.getState().accessToken===token) useAuthStore.getState().setUser(user);
      return user;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user data' };
    }
  },

  logout: ({ waitForDisconnect = false } = {}) => {
    const token = useAuthStore.getState().accessToken;
    clearBrokerInfo();
    expireAuthSession('logout');

    const disconnectPromise = notifyBackendDisconnect(token);
    if (waitForDisconnect) return disconnectPromise;

    disconnectPromise.catch(() => {});
    return Promise.resolve();
  }
};
