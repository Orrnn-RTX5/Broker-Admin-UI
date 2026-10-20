import { canAccessView, requiredPermissionForView } from '../utils/permissions.js';

export const VIEW_CAPABILITY_STATUS = Object.freeze({
  WORKING: 'working',
  PARTIAL: 'partial',
  STATIC_ONLY: 'static_only',
  LOCKED_NO_API: 'locked_no_api',
  API_AVAILABLE_NOT_INTEGRATED: 'api_available_not_integrated',
  CONTAINER_ONLY: 'container_only',
});

const {
  WORKING,
  PARTIAL,
  STATIC_ONLY,
  LOCKED_NO_API,
  API_AVAILABLE_NOT_INTEGRATED,
  CONTAINER_ONLY,
} = VIEW_CAPABILITY_STATUS;

const DEFAULT_CAPABILITY = Object.freeze({ status: WORKING });

const capability = (status, title, description, tone = 'warning') => Object.freeze({
  status,
  title,
  description,
  tone,
});

export const VIEW_CAPABILITIES = Object.freeze({
  Positions: capability(
    PARTIAL,
    'Positions partially connected',
    'This view uses an undocumented endpoint, so data can be unavailable until the backend contract is confirmed.'
  ),
  Deals: capability(
    PARTIAL,
    'Deals partially connected',
    'This view uses an undocumented endpoint, so data can be unavailable until the backend contract is confirmed.'
  ),
  'Downstream access': capability(
    PARTIAL,
    'Downstream access is gated',
    'Broker Admin only. The server answers only when RTX5_C09_DOWNSTREAM_ADMIN_ENABLED=1; saved access is not applied, connected or verified.'
  ),
  Gateways: capability(
    PARTIAL,
    'Gateways partially connected',
    'Gateway LP APIs exist, but this screen still calls undocumented manager feed endpoints.'
  ),
  Integrations: capability(
    STATIC_ONLY,
    'Integrations is static',
    'This page is a UI/status mockup right now and is not connected to backend APIs.'
  ),
  Automations: capability(
    STATIC_ONLY,
    'Automations is static',
    'This parent section has no backend workflow connected yet.'
  ),
  'Server Performance': capability(
    STATIC_ONLY,
    'Server Performance is static',
    'This automation page is not connected to a backend workflow yet.'
  ),
  Marketing: capability(
    STATIC_ONLY,
    'Marketing is static',
    'This automation page is not connected to a backend workflow yet.'
  ),
  Trading: capability(
    STATIC_ONLY,
    'Trading automation is static',
    'This automation page is not connected to a backend workflow yet.'
  ),
  'Security Audit': capability(
    STATIC_ONLY,
    'Security Audit is static',
    'This automation page is not connected to a backend workflow yet.'
  ),
  Configuration: capability(
    STATIC_ONLY,
    'Configuration is static',
    'This automation page is not connected to a backend workflow yet.'
  ),
  Security: capability(
    STATIC_ONLY,
    'Security is static',
    'This parent section has no connected backend workflow yet.'
  ),
  Certificates: capability(
    STATIC_ONLY,
    'Certificates is static',
    'This page is not connected to certificate management APIs yet.'
  ),
  Firewall: capability(
    STATIC_ONLY,
    'Firewall is static',
    'This page is not connected to firewall management APIs yet.'
  ),
  'Anti DDoS Protection': capability(
    STATIC_ONLY,
    'Anti DDoS Protection is static',
    'This page is informational and is not connected to backend APIs yet.'
  ),
  'Platform Config': capability(
    LOCKED_NO_API,
    'Platform Config is locked',
    'This Platform Config section is not enabled yet.',
    'info'
  ),
  Holidays: capability(
    LOCKED_NO_API,
    'Holidays is locked',
    'This Platform Config option is not enabled yet.',
    'info'
  ),
  'Session Overrides': capability(
    LOCKED_NO_API,
    'Session Overrides is locked',
    'This Platform Config option is not enabled yet.',
    'info'
  ),
  Leverages: capability(
    LOCKED_NO_API,
    'Leverages is locked',
    'This Platform Config option is not enabled yet.',
    'info'
  ),
  'Leverage Schedules': capability(
    LOCKED_NO_API,
    'Leverage Schedules is locked',
    'This Platform Config option is not enabled yet.',
    'info'
  ),
  'Swap-Free Configs': capability(
    LOCKED_NO_API,
    'Swap-Free Configs is locked',
    'This Platform Config option is not enabled yet.',
    'info'
  ),
  'Network Cluster': capability(
    LOCKED_NO_API,
    'Network Cluster is locked',
    'This network cluster section is locked for now.',
    'info'
  ),
  'Risk Management': capability(
    CONTAINER_ONLY,
    'Risk Management is a folder',
    'Open Exposure, Risk Events, Risk Limits, Suspicious Activity, or Risk Reports.',
    'info'
  ),
  Communications: capability(
    CONTAINER_ONLY,
    'Communications is a folder',
    'Open Auto Notification Rules, Email Campaigns, Message Center, Push Notifications, or SMS.',
    'info'
  ),
  Providers: capability(
    LOCKED_NO_API,
    'Providers is locked',
    'No payment-provider management API is wired for this screen yet.',
    'info'
  ),
  Withdrawals: capability(
    LOCKED_NO_API,
    'Withdrawals is locked',
    'Withdrawal request APIs are not available in the current backend contract.',
    'info'
  ),
  'Payment Gateways': capability(
    LOCKED_NO_API,
    'Payment Gateways is locked',
    'Gateway payment management APIs are not available in the current backend contract.',
    'info'
  ),
  Reconciliation: capability(
    LOCKED_NO_API,
    'Reconciliation is locked',
    'Payment reconciliation APIs are not available in the current backend contract.',
    'info'
  ),
  Chargebacks: capability(
    LOCKED_NO_API,
    'Chargebacks is locked',
    'Chargeback management APIs are not available in the current backend contract.',
    'info'
  ),
  'Corporate links': capability(
    LOCKED_NO_API,
    'Corporate links is locked',
    'No backend API or connected view is available for this option yet.',
    'info'
  ),
  'Utency Matching Engine': capability(
    LOCKED_NO_API,
    'Utency Matching Engine is locked',
    'No backend API or connected view is available for this option yet.',
    'info'
  ),
  'Ultency Matching Engine': capability(
    LOCKED_NO_API,
    'Utency Matching Engine is locked',
    'No backend API or connected view is available for this option yet.',
    'info'
  ),
  'Data Feeds': capability(
    LOCKED_NO_API,
    'Data Feeds is locked',
    'No backend API or connected view is available for this option yet.',
    'info'
  ),
  FCN: capability(
    LOCKED_NO_API,
    'FCN is locked',
    'No backend API or connected view is available for this option yet.',
    'info'
  ),
  Reports: capability(
    API_AVAILABLE_NOT_INTEGRATED,
    'Reports API is available',
    'Report export and execution report APIs exist, but this top-level page is not integrated yet.',
    'info'
  ),
  Routing: capability(
    API_AVAILABLE_NOT_INTEGRATED,
    'Routing API is available',
    'Route configuration APIs exist, but this top-level page is not integrated yet.',
    'info'
  ),
  'Funds & ETF': capability(
    API_AVAILABLE_NOT_INTEGRATED,
    'Funds & ETF API is available',
    'PAMM fund and investor APIs exist, but this top-level page is not integrated yet.',
    'info'
  ),
  Plugins: capability(
    API_AVAILABLE_NOT_INTEGRATED,
    'Plugins API is available',
    'Plugin APIs are connected under Plugin Management; this top-level page is not integrated yet.',
    'info'
  ),
  'Charts & Ticks': capability(
    LOCKED_NO_API,
    'Charts & Ticks is locked',
    'No chart or tick-stream backend API is wired for this screen yet.',
    'info'
  ),
  Subscriptions: capability(
    LOCKED_NO_API,
    'Subscriptions is locked',
    'No market-data subscription management API is wired for this screen yet.',
    'info'
  ),
  Mailbox: capability(
    LOCKED_NO_API,
    'Mailbox is locked',
    'No mailbox API is wired for this screen yet.',
    'info'
  ),
  'Live Update': capability(
    LOCKED_NO_API,
    'Live Update is locked',
    'No live-update management API is wired for this screen yet.',
    'info'
  ),
  'Support Center': capability(
    STATIC_ONLY,
    'Support Center is static',
    'This support page is not connected to backend account or support APIs yet.'
  ),
});

export const getViewCapability = (viewName) => {
  const label = String(viewName || '').trim();
  return VIEW_CAPABILITIES[label] || DEFAULT_CAPABILITY;
};

export const getViewCapabilityToast = (viewName) => {
  const currentCapability = getViewCapability(viewName);
  if (currentCapability.status === WORKING) return null;

  return {
    title: currentCapability.title || String(viewName || '').trim(),
    description: currentCapability.description,
    tone: currentCapability.tone || 'warning',
  };
};

export const shouldBlockViewNavigation = (viewName, user) => {
  const { status } = getViewCapability(viewName);
  // Container-only folder labels never navigate themselves; permitted sessions
  // expand them and open the children instead.
  if (status === CONTAINER_ONLY) return true;
  const staticallyLocked = status === LOCKED_NO_API || status === API_AVAILABLE_NOT_INTEGRATED;
  if (!staticallyLocked) return false;
  // No session (legacy single-arg callers, pre-auth render): fail closed.
  if (user === undefined || user === null) return true;
  // A statically locked view without a permission mapping has no session
  // capability that could grant it — it stays locked even for admins.
  if (requiredPermissionForView(viewName) === null) return true;
  // Otherwise the session's own capabilities decide: permitted sessions reach
  // the view, everyone else stays locked. No new permissions are granted here;
  // the central permission map in utils/permissions.js remains authoritative.
  return !canAccessView(user, viewName);
};

// A labeled dropdown folder unlocks for exactly the sessions that can reach at
// least one permission-guarded view inside it (the folder itself or any nested
// descendant). Views without a permission mapping never unlock a folder on
// their own, so purely static folders stay locked.
export const hasReachableViewInSubtree = (node, user) => {
  if (!node || user === undefined || user === null) return false;
  const stack = [node];
  while (stack.length > 0) {
    const candidate = stack.pop();
    if (!candidate || typeof candidate.label !== 'string') continue;
    if (
      requiredPermissionForView(candidate.label) !== null &&
      canAccessView(user, candidate.label) &&
      !shouldBlockViewNavigation(candidate.label, user)
    ) {
      return true;
    }
    if (Array.isArray(candidate.children)) {
      for (const child of candidate.children) stack.push(child);
    }
  }
  return false;
};

// Labels rendered as dropdown folders (rather than navigable views) in the
// sidebar navigator.
export const LOCKED_DROPDOWN_LABELS = new Set(['Automations', 'Security', 'Platform Config', 'Network Cluster', 'Risk Management', 'Communications', 'Support Center']);

// A labeled folder stays locked only while the session cannot reach any
// permission-guarded view inside it. Permitted sessions expand the folder and
// open its children; everyone else keeps the lock. Without a session the
// folders fail closed exactly as before.
export const isDropdownLockedForSession = (node, user) =>
  LOCKED_DROPDOWN_LABELS.has(node.label) && !hasReachableViewInSubtree(node, user);

// Navigation flags for a labeled dropdown folder, sharing the exact fields
// TreeItem gates on (item.blockedNavigation gates the chevron, row click and
// keyboard; item.lockedDropdown gates expansion + shows the lock). A folder
// the session unlocked must NOT carry the label-level block: folder labels
// are container-only and never navigate themselves, so keeping
// blockedNavigation=true would leave permitted sessions with a disabled
// chevron and dead rows — bit-for-bit the pre-fix behavior. A still-locked
// folder keeps the label-level block.
export const resolveFolderNavFlags = (node, user) => {
  const locked = isDropdownLockedForSession(node, user);
  return {
    lockedDropdown: locked,
    blockedNavigation: locked ? shouldBlockViewNavigation(node.label, user) : false,
  };
};
