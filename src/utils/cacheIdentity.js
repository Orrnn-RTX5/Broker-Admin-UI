import { groupAccessKey } from './groupAccess.js';

const identityPart = (value) => typeof value === 'string' || typeof value === 'number'
  ? String(value).trim() : '';

const sortedPermissions = (permissions) => {
  if (Array.isArray(permissions)) return [...new Set(permissions.filter(value => typeof value === 'string'))].sort();
  if (!permissions || typeof permissions !== 'object') return [];
  return Object.keys(permissions).sort().map(key => [key, permissions[key] === true]);
};

/** A stable authorization scope. Tokens are deliberately absent from this value. */
export const createCacheIdentity = (authStateOrUser) => {
  const isState = authStateOrUser && Object.hasOwn(authStateOrUser, 'user');
  if (isState && (authStateOrUser.isAuthenticated === false || !authStateOrUser.accessToken)) return null;
  const user = isState ? authStateOrUser.user : authStateOrUser;
  if (!user || typeof user !== 'object') return null;
  const broker = identityPart(user.broker_id ?? user.brokerId);
  const login = identityPart(user.login ?? user.id);
  if (!broker || !login) return null;
  const scopedUser = {
    ...user,
    broker_id: broker,
    login,
    allowed_groups: Array.isArray(user.allowed_groups) ? [...user.allowed_groups].sort() : user.allowed_groups,
  };
  return JSON.stringify([
    broker, login, groupAccessKey(scopedUser), user.role ?? null, user.is_admin ?? null,
    sortedPermissions(user.permissions),
  ]);
};

const readStorage = (storage, key) => {
  try { return globalThis[storage]?.getItem(key) ?? null; } catch { return null; }
};

const readJson = (storage, key) => {
  try { return JSON.parse(readStorage(storage, key) ?? 'null'); } catch { return null; }
};

const tokenFromSession = (session) => session?.token || session?.access_token || session?.session_token || null;

/** Reads the persisted user without importing the auth store into pure cache helpers. */
export const getStoredCacheIdentity = () => {
  const persisted = readJson('localStorage', 'rtx5-auth-storage');
  const state = persisted?.state || persisted;
  if (state?.isAuthenticated === false) return null;
  const session = readJson('sessionStorage', 'auth');
  const sessionToken = tokenFromSession(session);
  const localToken = readStorage('localStorage', 'authToken');
  if (sessionToken && localToken && sessionToken !== localToken) return null;
  const activeToken = sessionToken || localToken || state?.accessToken;
  if (!activeToken) return null;

  // A new sign-in may have written its token before its persisted user. Never
  // borrow the previous user's authorization in that interval.
  let user = state?.accessToken === activeToken && state?.isAuthenticated !== false ? state.user : null;
  if (!user) user = session?.user || session?.manager || session?.admin || session;
  const identity = createCacheIdentity(user);
  if (!identity) return null;
  const broker = identityPart(user.broker_id ?? user.brokerId);
  const login = identityPart(user.login ?? user.id);
  const sessionBroker = identityPart(session?.broker_id ?? session?.brokerId);
  const sessionLogin = identityPart(session?.login ?? session?.user?.login);
  const localBroker = identityPart(readStorage('localStorage', 'brokerId'));
  if ((sessionBroker && sessionBroker !== broker) || (sessionLogin && sessionLogin !== login)
    || (localBroker && localBroker !== broker)) return null;
  return identity;
};

/** Encode the complete scope to avoid collisions between users or permissions. */
export const identitySnapshotKey = (prefix, identity) => typeof identity === 'string' && identity
  ? `${prefix}${encodeURIComponent(identity)}` : null;
