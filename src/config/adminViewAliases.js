// Window-menu / header labels that have no dedicated main-area renderer are
// mapped here to the existing views that already render that data elsewhere
// in the app, so they never fall through to the empty group-lookup state in
// AdminDataTable. Entries stay label-based (no tenant, broker, or account
// specifics) and reuse the target view's own data layer — no new backend
// calls, no placeholder data.
export const ADMIN_VIEW_ALIASES = Object.freeze({
  // No dedicated Online Users screen exists (services/api.js only exposes
  // unused OnlineUsers/AccountsOnline helpers). Live sessions already render
  // on the Managers directory Online tab (ManagerOnline), so that is the
  // closest existing equivalent.
  'Online Users': Object.freeze({ view: 'Managers', initialTab: 'Online' }),
  // No dedicated main-area Journal screen exists. The broker journal already
  // renders in the Operations Terminal dock (ServerJournal + useServerJournal
  // over the same fetchServerJournal data layer), so the main-area Journal
  // renderer reuses that exact surface and data layer.
  Journal: Object.freeze({ view: 'Journal' }),
});

const DEFAULT_TARGET = Object.freeze({ view: null, initialTab: undefined });

export const resolveAdminViewTarget = (viewLabel) => {
  const label = String(viewLabel || '').trim();
  const alias = ADMIN_VIEW_ALIASES[label];
  if (!alias) return { ...DEFAULT_TARGET, view: label };
  return { view: alias.view, initialTab: alias.initialTab };
};
