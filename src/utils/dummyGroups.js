/** Local examples for learning the Groups screens. Never send these to an API. */
export const DUMMY_GROUPS_VERSION = 2;
export const DUMMY_GROUPS_STORAGE_KEY = 'rtx5-admin-dummy-groups-v1';
export const DUMMY_GROUPS_ROOT = 'Admin';

const clone = (value) => JSON.parse(JSON.stringify(value));
const equalPath = (left, right) => left.toLowerCase() === right.toLowerCase();
const belowPath = (candidate, parent) => candidate.toLowerCase().startsWith(`${parent.toLowerCase()}\\`);
const compareNames = (left, right) => left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' });

export const createDummyId = (prefix = 'dummy-group') => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

export const normalizeDummyPath = (value) => {
  const path = String(value ?? '').trim().replaceAll('/', '\\');
  const parts = path.split('\\').map(part => part.trim());
  if (!path || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Enter a group path without empty folders, such as Admin\\demo\\4540\\New Group.');
  }
  if (parts.some(part => /[<>:"|?*]/.test(part) || [...part].some(character => character.charCodeAt(0) < 32))) {
    throw new Error('Group and folder names cannot contain < > : " | ? * or control characters.');
  }
  if (equalPath(parts[0], DUMMY_GROUPS_ROOT)) parts[0] = DUMMY_GROUPS_ROOT;
  const normalized = parts.join('\\');
  if (normalized.length > 128) throw new Error('The complete group path must be 128 characters or fewer.');
  return normalized;
};

export const getDummyParentPath = (path = '') => {
  const position = String(path).lastIndexOf('\\');
  return position < 0 ? '' : String(path).slice(0, position);
};

const defaultRates = () => ({ market: 2, limit: 'Default', stop: 'Default', stopLimit: 'Default' });
const defaultSymbol = (path, index) => ({
  id: `dummy-symbol-${index}`,
  path,
  spreadDifference: index === 1 ? 6 : 0,
  spreadBalance: 50,
  useDefaultSpread: index !== 1,
  margin: { useDefault: true, initial: 0, hedged: 100000, maintenance: 0 },
  rates: {
    liquidity: 'Default', currency: 'Default',
    initialBuy: defaultRates(), initialSell: defaultRates(),
    maintenanceBuy: defaultRates(), maintenanceSell: defaultRates(),
  },
  swaps: {
    type: 'Default', long: 'Default', short: 'Default', daysInYear: 'Default', holidays: 'Default',
    multipliers: Object.fromEntries(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => [day, 'Default'])),
  },
});

export const createDummyGroupDefaults = () => ({
  description: 'Sample trading group',
  settings: {
    common: {
      tradeServer: 'RTX5 Main Server', authentication: 'Normal', currency: 'USD', digits: 2,
      oneTimePassword: 'Disabled', pushNotifications: 'Enabled', minimumPasswordLength: 8,
      forceOneTimePassword: false, enableConnections: true, certificateConfirmation: false,
      changePassword: true, riskWarning: true, regulatoryRestrictions: false,
    },
    statistics: {
      accountCount: 12, activePositions: 6, totalVolume: 4.25, totalBalance: 125000,
      totalEquity: 127450, totalMargin: 3200, freeMargin: 124250, netExposure: 2500,
    },
    company: {
      name: 'Example Trading Ltd', description: 'Sample trading group',
      website: 'https://example.com', email: 'info@example.com',
      depositUrl: 'https://example.com/deposit', withdrawalUrl: 'https://example.com/withdraw',
      supportSite: 'https://example.com/support', supportEmail: 'support@example.com', templatesFolder: 'templates\\example',
    },
    news: { news: 'Full package', categories: 'Finance, Markets, Company', languages: 'English', internalMail: true },
    permissions: {
      maximumSymbols: 'Unlimited', maximumPositions: 'Unlimited', maximumOrders: 'Unlimited',
      history: 'All', deposit: 10000, leverage: 100, annualInterest: 0,
      tradingSignals: 'All brokers', transferFunds: 'Disabled',
      expertAdvisors: true, trailingStops: true, chargeSwaps: true,
      fifo: false, prohibitHedge: false, dealCost: false, inactivityDays: 360,
    },
    margin: {
      riskManagement: 'Retail Forex, CFD, Futures with hedged positions', marginCallLevel: 100,
      stopOutLevel: 50, stopOutMode: 'Percent', floatingLeverage: 'None',
      stopOutHedged: false, compensateNegativeBalance: true, withdrawCredit: false,
      unrealizedProfit: 'Use profit and loss', dailyFixedProfit: 'Use profit and loss',
      releaseFixedProfit: false, virtualCredit: 0,
    },
    reports: {
      generateData: 'End of Day and End of Month', generateStatements: true,
      sendEmail: false, statementMode: 'Daily and monthly', archiveReports: true,
    },
  },
  symbols: ['*', 'forex\\*', 'forex\\EURUSD', 'forex\\GBPUSD', 'metals\\XAUUSD', 'indices\\US500'].map(defaultSymbol),
  commissions: [{
    id: 'dummy-commission-standard', name: 'Sample standard commission', symbol: 'forex\\*',
    description: 'Example volume-based commission', type: 'Standard', range: 'Volume', charge: 'Instant',
    turnoverCurrency: 'USD', entry: 'All', action: 'All', profit: 'All', reason: 'All',
    tiers: [{ id: 'dummy-tier-1', from: 0, to: 1000, commission: 9, mode: 'Deposit currency', per: 'Volume', minimum: 0, maximum: 0, currency: 'USD' }],
  }],
});

const mergeObjects = (base, patch) => {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value === undefined) continue;
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeObjects(base?.[key] && typeof base[key] === 'object' ? base[key] : {}, value)
      : value;
  }
  return result;
};

/** Create a detached, fully populated record; raw values remain separate from UI '(Dummy)' labels. */
export const makeDummyGroup = (draft = {}) => {
  const path = normalizeDummyPath(draft.path || draft.name);
  const record = mergeObjects(createDummyGroupDefaults(), draft);
  const common = record.settings.common;
  const margin = record.settings.margin;
  // Accept compact top-level drafts while treating settings as the canonical editor values.
  if (draft.currency !== undefined && draft.settings?.common?.currency === undefined) common.currency = draft.currency;
  for (const field of ['riskManagement', 'marginCallLevel', 'stopOutLevel']) {
    if (draft[field] !== undefined && draft.settings?.margin?.[field] === undefined) margin[field] = draft[field];
  }
  if (draft.description !== undefined && draft.settings?.company?.description === undefined) record.settings.company.description = draft.description;
  return clone({
    ...record,
    id: draft.id || createDummyId(),
    path, name: path, group: path, isDummy: true, source: 'dummy',
    currency: common.currency, riskManagement: margin.riskManagement,
    description: record.settings.company.description,
    marginCallLevel: Number(margin.marginCallLevel), stopOutLevel: Number(margin.stopOutLevel),
  });
};

/** Validate one prospective group against the collection; returns its normalized path or throws. */
export const validateDummyGroup = (draft, groups = [], excludeId) => {
  const path = normalizeDummyPath(draft.path || draft.name);
  for (const group of groups) {
    if (group.id === excludeId) continue;
    if (equalPath(group.path, path)) throw new Error(`A group named "${path}" already exists.`);
  }
  const currency = draft.settings?.common?.currency ?? draft.currency;
  if (currency !== undefined && !/^[A-Z]{3,8}$/.test(String(currency))) {
    throw new Error('Enter a currency code using 3 to 8 uppercase letters.');
  }
  for (const field of ['marginCallLevel', 'stopOutLevel']) {
    const value = draft.settings?.margin?.[field] ?? draft[field];
    if (value !== undefined && (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      throw new Error(`${field === 'marginCallLevel' ? 'Margin call' : 'Stop out'} level must be a non-negative number.`);
    }
  }
  for (const field of ['symbols', 'commissions']) {
    if (draft[field] !== undefined && !Array.isArray(draft[field])) throw new Error(`${field === 'symbols' ? 'Symbols' : 'Commissions'} must be a list.`);
  }
  return path;
};

export const createDummyGroupsSeed = () => {
  const groups = [];
  for (const [category, count] of [['contest', 4], ['demo', 4], ['real', 1]]) {
    for (let index = 1; index <= count; index += 1) {
      const currency = index === 3 ? 'EUR' : 'USD';
      groups.push(makeDummyGroup({
        id: `dummy-group-${category}-${index}`,
        path: `Admin\\${category}\\4540\\Grp${String(index).padStart(2, '0')}`,
        description: `Sample ${category} trading group ${index}`,
        settings: {
          common: { currency },
          company: { description: `Sample ${category} trading group ${index}` },
          statistics: { accountCount: 8 + index * 4, activePositions: 2 + index, totalVolume: index * 4.25, totalBalance: index * 25000, totalEquity: index * 25490 },
          margin: { marginCallLevel: 100, stopOutLevel: index === 4 ? 30 : 50 },
          permissions: { deposit: category === 'real' ? 0 : 10000, leverage: index === 4 ? 200 : 100 },
        },
      }));
    }
  }
  return groups;
};

export const getDummyGroupCount = (groups, path = '') => groups.filter(group => !path || equalPath(group.path, path) || belowPath(group.path, path)).length;

const EXAMPLE_CLIENTS = ['Ava Patel', 'Liam Chen', 'Noah Fischer', 'Mia Rossi', 'Ethan Okafor', 'Zoe Martin', 'Lucas Silva', 'Emma Novak', 'Aiden Kim', 'Sofia Alvarez', 'Leo Dubois', 'Isla Haddad'];
const hashText = (text) => {
  let hash = 7;
  for (const character of String(text)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
};

/** Example accounts for one group, derived from its statistics; the same group always yields the same list. */
export const getDummyGroupAccounts = (group) => {
  const statistics = group?.settings?.statistics || {};
  const count = Math.min(Math.max(Math.trunc(Number(statistics.accountCount) || 0), 0), 200);
  const seed = hashText(group?.path);
  const base = 200000 + (seed % 700) * 100;
  const totalBalance = Number(statistics.totalBalance) || 0;
  const equityRatio = totalBalance > 0 ? (Number(statistics.totalEquity) || totalBalance) / totalBalance : 1;
  return Array.from({ length: count }, (_, index) => {
    const balance = count ? Math.round((totalBalance / count) * (0.6 + ((seed + index * 7919) % 80) / 100)) : 0;
    return {
      id: `dummy-account-${group.id}-${index + 1}`,
      login: String(base + index + 1),
      name: EXAMPLE_CLIENTS[(seed + index) % EXAMPLE_CLIENTS.length],
      group: group.path,
      balance,
      equity: Math.round(balance * equityRatio),
      currency: group.currency,
      status: index % 9 === 8 ? 'inactive' : 'active',
      isDummy: true,
    };
  });
};

/** Every group and folder path that can hold a subgroup, parents before children. */
export const listDummyContainerPaths = (groups) => {
  const paths = new Map();
  for (const group of groups) {
    const parts = group.path.split('\\');
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const candidate = parts.slice(0, depth).join('\\');
      if (!paths.has(candidate.toLowerCase())) paths.set(candidate.toLowerCase(), candidate);
    }
  }
  return [...paths.values()].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
};

/** A group record owns its row; groups below it are its subgroups. Pure folders have no record. */
export const getDummyFolderChildren = (groups, path = '') => {
  const normalized = path ? normalizeDummyPath(path) : '';
  const depth = normalized ? normalized.split('\\').length : 0;
  const nodes = new Map();
  for (const group of groups) {
    if (normalized && !belowPath(group.path, normalized)) continue;
    const parts = group.path.split('\\');
    if (parts.length <= depth) continue;
    const childPath = parts.slice(0, depth + 1).join('\\');
    const key = childPath.toLowerCase();
    const node = nodes.get(key) || { id: `dummy-folder:${childPath}`, type: 'folder', label: parts[depth], path: childPath, count: 0, isDummy: true };
    if (parts.length === depth + 1) Object.assign(node, { id: group.id, type: 'group', path: group.path, groupName: group.path, group });
    else node.count += 1;
    nodes.set(key, node);
  }
  // Admin remains navigable after deleting the last example group.
  if (!normalized && !nodes.size) nodes.set('admin', { id: 'dummy-folder:Admin', type: 'folder', label: 'Admin', path: 'Admin', count: 0, isDummy: true });
  return [...nodes.values()].sort((left, right) => (left.type === right.type ? 0 : left.type === 'folder' ? -1 : 1) || compareNames(left, right));
};

export const addDummyGroup = (groups, draft) => {
  const path = validateDummyGroup(draft, groups);
  const group = makeDummyGroup({ ...draft, path, id: createDummyId() });
  return { groups: [...groups, group], group };
};

export const updateDummyGroup = (groups, id, patch) => {
  const existing = groups.find(group => group.id === id);
  if (!existing) throw new Error('This dummy group no longer exists.');
  const merged = mergeObjects(clone(existing), patch);
  if (patch.name && !patch.path) merged.path = patch.name;
  if (patch.currency !== undefined && patch.settings?.common?.currency === undefined) merged.settings.common.currency = patch.currency;
  for (const field of ['riskManagement', 'marginCallLevel', 'stopOutLevel']) {
    if (patch[field] !== undefined && patch.settings?.margin?.[field] === undefined) merged.settings.margin[field] = patch[field];
  }
  if (patch.description !== undefined && patch.settings?.company?.description === undefined) merged.settings.company.description = patch.description;
  const path = validateDummyGroup(merged, groups, id);
  const group = makeDummyGroup({ ...merged, id, path });
  const subgroups = equalPath(existing.path, path) ? [] : groups.filter(item => belowPath(item.path, existing.path));
  if (subgroups.length && belowPath(path, existing.path)) throw new Error('A group cannot be moved inside itself.');
  if (subgroups.length && groups.some(item => item.id !== id && !subgroups.includes(item) && belowPath(item.path, path))) {
    throw new Error('A group or folder already uses the destination path.');
  }
  const moved = groups.map(item => (item.id === id ? group : subgroups.includes(item)
    ? makeDummyGroup({ ...item, path: `${path}${item.path.slice(existing.path.length)}` })
    : item));
  return { groups: moved, group };
};

export const duplicateDummyGroup = (groups, id, requestedPath) => {
  const source = groups.find(group => group.id === id);
  if (!source) throw new Error('This dummy group no longer exists.');
  let path = requestedPath;
  if (!path) {
    const base = `${source.path} Copy`;
    path = base;
    let index = 2;
    while (groups.some(group => equalPath(group.path, path))) path = `${base} ${index++}`;
  }
  return addDummyGroup(groups, { ...clone(source), path, name: path });
};

export const deleteDummyGroup = (groups, id) => {
  if (!groups.some(group => group.id === id)) throw new Error('This dummy group no longer exists.');
  return groups.filter(group => group.id !== id);
};

export const renameDummyFolder = (groups, folderPath, requestedPath) => {
  const from = normalizeDummyPath(folderPath);
  const to = normalizeDummyPath(requestedPath);
  if (equalPath(from, DUMMY_GROUPS_ROOT)) throw new Error('The Admin root folder cannot be renamed.');
  if (from === to) return groups;
  if (belowPath(to, from)) throw new Error('A folder cannot be moved inside itself.');
  const moving = groups.filter(group => equalPath(group.path, from) || belowPath(group.path, from));
  if (!moving.length) throw new Error('This dummy folder no longer exists.');
  if (groups.some(group => !moving.includes(group) && (equalPath(group.path, to) || belowPath(group.path, to)))) {
    throw new Error('A group or folder already uses the destination path.');
  }
  const moved = groups.map(group => moving.includes(group)
    ? makeDummyGroup({ ...group, path: `${to}${group.path.slice(from.length)}` })
    : group);
  for (const group of moved) validateDummyGroup(group, moved, group.id);
  return moved;
};

export const deleteDummyFolder = (groups, folderPath) => {
  const path = normalizeDummyPath(folderPath);
  if (equalPath(path, DUMMY_GROUPS_ROOT)) throw new Error('The Admin root folder cannot be deleted.');
  const inside = group => equalPath(group.path, path) || belowPath(group.path, path);
  if (!groups.some(inside)) throw new Error('This dummy folder no longer exists.');
  return groups.filter(group => !inside(group));
};

/** Reject corrupt or obsolete browser data instead of letting it break navigation. */
export const restoreDummyGroups = (stored) => {
  if (!Array.isArray(stored) || stored.length > 2000) return createDummyGroupsSeed();
  try {
    const groups = stored.map(group => makeDummyGroup(group));
    const ids = new Set();
    for (const group of groups) {
      if (ids.has(group.id)) throw new Error('Duplicate identity');
      ids.add(group.id);
      validateDummyGroup(group, groups, group.id);
    }
    return groups;
  } catch {
    return createDummyGroupsSeed();
  }
};
