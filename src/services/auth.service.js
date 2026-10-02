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
export const AuthService = {
  getMe: async () => {
    const token=useAuthStore.getState().accessToken;
    const sequence=++accessRequestSequence;
    try {
      const response = await api.get('/manager/api/v2/auth/me', { _allowAuthFailure: true });
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
