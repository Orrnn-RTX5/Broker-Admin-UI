import { api } from '../lib/api';

const cleanParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export const ManagerService = {
  getGroupList: async (params = {}) => {
    const res = await api.get('/manager/GroupList', {
      params: cleanParams(params),
    });
    return res.data;
  },

  getGroupRoutingOverviewList: async () => {
    const res = await api.get('/manager/GroupRoutingOverviewList');
    return res.data;
  },

  createGroup: async (groupData) => {
    const res = await api.post('/manager/GroupCreate', groupData);
    return res.data;
  },

  updateGroup: async (groupData) => {
    const { originalName, ...payload } = groupData;
    const res = await api.post('/manager/GroupUpdate', payload, {
      params: { group_name: originalName || payload.name }
    });
    return res.data;
  },

  deleteGroup: async (groupName) => {
    const res = await api.get('/manager/GroupDelete', {
      params: { group: groupName }
    });
    return res.data;
  },

  getGroupStats: async (groupName) => {
    const res = await api.get('/manager/GroupStats', {
      params: { group: groupName }
    });
    return res.data;
  },

  addSymbol: async (symbolData) => {
    const res = await api.get('/manager/SymbolAdd', {
      params: symbolData
    });
    return res.data;
  },

  disableSymbol: async (symbol) => {
    const res = await api.get('/manager/SymbolDisable', { params: { symbol } });
    return res.data;
  },

  enableSymbol: async (symbol) => {
    const res = await api.get('/manager/SymbolEnable', { params: { symbol } });
    return res.data;
  },

  updateSymbol: async (updates) => {
    const res = await api.get('/manager/SymbolUpdate', {
      params: updates
    });
    return res.data;
  },

  getSymbolSession: async (symbol) => {
    const res = await api.get('/manager/SymbolSessionGet', { params: { symbol } });
    return res.data;
  },
  getSymbolSet: async (groupName, symbol) => {
    const res = await api.get('/manager/GroupSymbolSet', { params: { group: groupName, symbol } });
    return res.data;
  },

  setSymbolSession: async (symbol, sessions) => {
    const res = await api.post('/manager/GroupSymbolSet', sessions, {
      params: { group: symbol }
    });
    return res.data;
  },

  getGroupSymbols: async (groupName) => {
    const res = await api.get('/manager/GroupSymbolList', { params: { group: groupName } });
    return res.data;
  },

  toggleGroupSymbol: async (group, symbol, enabled) => {
    const res = await api.get('/manager/GroupSymbolToggle', {
      params: { group, symbol, enabled }
    });
    return res.data;
  },

  getSymbolList: async (group) => {
    const res = await api.get('/manager/SymbolList', { params: { group } });
    return res.data;
  },

  getSwapFreeGroups: async () => {
    const res = await api.get('/manager/SwapFreeGroupList');
    return res.data;
  },

  setSwapFreeGroup: async (data) => {
    const res = await api.post('/manager/SwapFreeGroupSet', data);
    return res.data;
  },

  deleteSwapFreeGroup: async (groupId) => {
    const res = await api.get('/manager/SwapFreeGroupDelete', { params: { group_id: groupId } });
    return res.data;
  },

  getRoleList: async () => {
    const res = await api.get('/manager/ManagerRoleList');
    return res.data;
  },

  createRole: async (roleData) => {
    const res = await api.post('/manager/ManagerRoleCreate', roleData);
    return res.data;
  },

  createManager: async (managerData) => {
    const res = await api.post('/manager/ManagerCreate', managerData);
    return res.data;
  },

  updateManagerRole: async (managerLogin, roleId) => {
    const res = await api.get('/manager/ManagerUpdate', {
      params: { manager_login: managerLogin, role_id: roleId }
    });
    return res.data;
  },

  createCommissionSchedule: async (data) => {
    const res = await api.post('/manager/CommissionScheduleCreate', data);
    return res.data;
  },

  deleteCommissionSchedule: async (scheduleId) => {
    const res = await api.get('/manager/CommissionScheduleDelete', {
      params: { schedule_id: scheduleId }
    });
    return res.data;
  },

  getCommissionScheduleList: async () => {
    const res = await api.get('/manager/CommissionScheduleList');
    return res.data;
  },

  // --- DYNAMIC LEVERAGE ---
  createDynamicLeverage: async (data) => {
    const res = await api.post('/manager/DynamicLeverageCreate', data);
    return res.data;
  },

  getDynamicLeverageList: async () => {
    const res = await api.get('/manager/DynamicLeverageList');
    return res.data;
  },

  deleteDynamicLeverage: async (ruleId) => {
    const res = await api.get('/manager/DynamicLeverageDelete', {
      params: { rule_id: ruleId }
    });
    return res.data;
  },

  // --- HOLIDAYS ---
  createHoliday: async (data) => {
    const res = await api.post('/manager/HolidayCreate', data);
    return res.data;
  },

  getHolidayList: async () => {
    const res = await api.get('/manager/HolidayListExt');
    return res.data;
  },

  deleteHoliday: async (holidayId) => {
    const res = await api.get('/manager/HolidayDelete', {
      params: { holiday_id: holidayId }
    });
    return res.data;
  },

  // --- MARKET DEPTH (port 8091, no /manager prefix) ---
  getMarketDepthConfig: async (symbol) => {
    const res = await api.get(`/ext-api/MarketDepthConfigGet`, { params: { symbol } });
    return res.data;
  },

  setMarketDepthConfig: async (data) => {
    const res = await api.post(`/ext-api/MarketDepthConfigSet`, data);
    return res.data;
  },

  // --- SESSION OVERRIDES (port 8091, no /manager prefix) ---
  getSessionOverrideList: async (symbol, group) => {
    const params = { symbol };
    if (group) params.group = group;
    const res = await api.get(`/ext-api/SessionOverrideList`, { params });
    return res.data;
  },

  setSessionOverrides: async (symbol, group, overrides) => {
    const res = await api.post(`/ext-api/SessionOverrideSet`, overrides, {
      params: { symbol, group }
    });
    return res.data;
  },

  deleteSessionOverride: async (overrideId) => {
    const res = await api.get(`/ext-api/SessionOverrideDelete`, {
      params: { override_id: overrideId }
    });
    return res.data;
  },

  // --- LEVERAGE SCHEDULES (port 8091, no /manager prefix) ---
  getLeverageScheduleList: async (group) => {
    const params = {};
    if (group) params.group = group;
    const res = await api.get(`/ext-api/LeverageScheduleList`, { params });
    return res.data;
  },

  createLeverageSchedule: async (data) => {
    const res = await api.post(`/ext-api/LeverageScheduleCreate`, data);
    return res.data;
  },

  deleteLeverageSchedule: async (scheduleId) => {
    const res = await api.get(`/ext-api/LeverageScheduleDelete`, {
      params: { schedule_id: scheduleId }
    });
    return res.data;
  },

  // --- SPREAD SCHEDULES (port 8091, no /manager prefix) ---
  getSpreadScheduleList: async (symbol) => {
    const res = await api.get(`/ext-api/SpreadScheduleList`, { params: { symbol } });
    return res.data;
  },

  createSpreadSchedule: async (data) => {
    const res = await api.post(`/ext-api/SpreadScheduleCreate`, data);
    return res.data;
  },

  deleteSpreadSchedule: async (scheduleId) => {
    const res = await api.get(`/ext-api/SpreadScheduleDelete`, {
      params: { schedule_id: scheduleId }
    });
    return res.data;
  },

  // --- HIDDEN MARKUP ---
  getHiddenMarkupList: async () => {
    const res = await api.get('/manager/HiddenMarkupList');
    return res.data;
  },

  setHiddenMarkup: async (data) => {
    const res = await api.post('/manager/HiddenMarkupSet', data);
    return res.data;
  },

  deleteHiddenMarkup: async (groupName, accountNumber) => {
    const res = await api.post('/manager/HiddenMarkupDelete', {
      group_name: groupName,
      account_number: accountNumber
    });
    return res.data;
  },

  // --- LP DISPATCH DELAY ---
  getLPDispatchDelay: async () => {
    const res = await api.get('/manager/LPDispatchDelayGet');
    return res.data;
  },

  setLPDispatchDelay: async (delayMs) => {
    const res = await api.post('/manager/LPDispatchDelaySet', {
      dispatch_delay_ms: Number(delayMs)
    });
    return res.data;
  },

  // --- TRADING / EXECUTION ---

  getPositionsAll: async (page = 1, limit = 50) => {
    const res = await api.get('/manager/PositionsAll', {
      params: { page, limit }
    });
    return res.data;
  },

  getPositions: async (logins = [], page = 1, limit = 50) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);
    logins.forEach(l => params.append('logins[]', l));

    const res = await api.get(`/manager/Positions?${params.toString()}`);
    return res.data;
  },

  getBrokerOrders: async (limitOrParams = 100, offset = 0) => {
    const params = typeof limitOrParams === 'object' && limitOrParams !== null
      ? cleanParams(limitOrParams)
      : { limit: limitOrParams, offset };
    const res = await api.get('/manager/BrokerOrders', {
      params
    });
    return res.data;
  },

  getOrders: async (logins = []) => {
    const params = new URLSearchParams();
    logins.forEach(l => params.append('logins[]', l));

    const res = await api.get(`/manager/Orders?${params.toString()}`);
    return res.data;
  },

  getOrderHistory: async (login, from, to) => {
    const params = { login };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await api.get('/manager/OrderHistory', { params });
    return res.data;
  },

  getPendingOrderHistory: async (login, from, to) => {
    const params = { login };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await api.get('/manager/PendingOrderHistory', { params });
    return res.data;
  },

  getBrokerDeals: async (pageOrParams = 1, limit = 50) => {
    const params = typeof pageOrParams === 'object' && pageOrParams !== null
      ? cleanParams(pageOrParams)
      : { page: pageOrParams, limit };
    const res = await api.get('/manager/BrokerDeals', {
      params
    });
    return res.data;
  },

  // --- RBAC: ROLES ---
  updateRole: async (roleId, data) => {
    const res = await api.post('/manager/ManagerRoleUpdate', data, {
      params: { role_id: roleId }
    });
    return res.data;
  },

  deleteRole: async (roleId) => {
    const res = await api.get('/manager/ManagerRoleDelete', {
      params: { role_id: roleId }
    });
    return res.data;
  },

  // --- MANAGER ACCOUNTS ---
  getManagerList: async () => {
    const res = await api.get('/manager/ManagerList');
    return res.data;
  },

  getManagerDetail: async (login) => {
    const res = await api.get('/manager/ManagerGet', {
      params: { manager_login: login }
    });
    return res.data;
  },

  updateManager: async (login, params) => {
    const res = await api.get('/manager/ManagerUpdate', {
      params: { manager_login: login, ...params }
    });
    return res.data;
  },

  deleteManager: async (login) => {
    const res = await api.get('/manager/ManagerDelete', {
      params: { manager_login: login }
    });
    return res.data;
  },

  getManagerActivityLog: async (login, from, to) => {
    const params = { manager_login: login };
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get('/manager/ManagerActivityLog', { params });
    return res.data;
  },

  getManagerOnline: async () => {
    const res = await api.get('/manager/ManagerOnline');
    return res.data;
  },
};

