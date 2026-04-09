import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
export const ManagerService = {
  getGroupList: async () => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupList?id=${token}`);
    return res.data;
  },

  createGroup: async (groupData) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/GroupCreate?id=${token}`, groupData);
    return res.data;
  },

  updateGroup: async (groupData) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/GroupUpdate`, groupData, {
      params: { id: token, group_name: groupData.name }
    });
    return res.data;
  },

  deleteGroup: async (groupName) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupDelete`, {
      params: { id: token, group: groupName }
    });
    return res.data;
  },

  getGroupStats: async (groupName) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupStats`, {
      params: { id: token, group: groupName }
    });
    return res.data;
  },

  addSymbol: async (symbolData) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolAdd`, {
      params: { id: token, ...symbolData }
    });
    return res.data;
  },

  disableSymbol: async (symbol) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolDisable`, { params: { id: token, symbol } });
    return res.data;
  },

  enableSymbol: async (symbol) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolEnable`, { params: { id: token, symbol } });
    return res.data;
  },

  updateSymbol: async (updates) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolUpdate`, {
      params: { id: token, ...updates }
    });
    return res.data;
  },

  getSymbolSession: async (symbol) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolSessionGet`, { params: { id: token, symbol } });
    return res.data;
  },
  getSymbolSet: async (groupName, symbol) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupSymbolSet`, { params: { id: token, group: groupName, symbol } });
    return res.data;
  },

  setSymbolSession: async (symbol, sessions) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/GroupSymbolSet?id=${token}&group=${symbol}`, sessions);
    return res.data;
  },

  getGroupSymbols: async (groupName) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupSymbolList`, { params: { id: token, group: groupName } });
    return res.data;
  },

  toggleGroupSymbol: async (group, symbol, enabled) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/GroupSymbolToggle`, {
      params: { id: token, group, symbol, enabled }
    });
    return res.data;
  },

  getSymbolList: async (group) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SymbolList`, { params: { id: token, group } });
    return res.data;
  },

  getSwapFreeGroups: async () => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SwapFreeGroupList`, { params: { id: token } });
    return res.data;
  },

  setSwapFreeGroup: async (data) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/SwapFreeGroupSet?id=${token}`, data);
    return res.data;
  },

  deleteSwapFreeGroup: async (groupId) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/SwapFreeGroupDelete`, { params: { id: token, group_id: groupId } });
    return res.data;
  },

  getRoleList: async () => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/ManagerRoleList?id=${token}`);
    return res.data;
  },

  createRole: async (roleData) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/ManagerRoleCreate?id=${token}`, roleData);
    return res.data;
  },

  createManager: async (managerData) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/ManagerCreate?id=${token}`, managerData);
    return res.data;
  },

  updateManagerRole: async (managerLogin, roleId) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/ManagerUpdate`, {
      params: { id: token, manager_login: managerLogin, role_id: roleId }
    });
    return res.data;
  },

  createCommissionSchedule: async (data) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/CommissionScheduleCreate?id=${token}`, data);
    return res.data;
  },

  deleteCommissionSchedule: async (scheduleId) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/CommissionScheduleDelete`, {
      params: { id: token, schedule_id: scheduleId }
    });
    return res.data;
  },

  getCommissionScheduleList: async () => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/CommissionScheduleList?id=${token}`);
    return res.data;
  },

  // --- DYNAMIC LEVERAGE ---
  createDynamicLeverage: async (data) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/DynamicLeverageCreate?id=${token}`, data);
    return res.data;
  },

  getDynamicLeverageList: async () => {
    const token = useAuthStore.getState().accessToken;
    // As instructed: same endpoint as create, but GET with id
    const res = await api.get(`/manager/DynamicLeverageCreate?id=${token}`);
    return res.data;
  },

  deleteDynamicLeverage: async (ruleId) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/DynamicLeverageDelete`, {
      params: { id: token, rule_id: ruleId }
    });
    return res.data;
  },

  // --- HOLIDAYS ---
  createHoliday: async (data) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/HolidayCreate?id=${token}`, data);
    return res.data;
  },

  getHolidayList: async () => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/HolidayListExt?id=${token}`);
    return res.data;
  },

  deleteHoliday: async (holidayId) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/HolidayDelete`, {
      params: { id: token, holiday_id: holidayId }
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

  // --- TRADING / EXECUTION ---

  getPositionsAll: async (page = 1, limit = 50) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/PositionsAll`, {
      params: { id: token, page, limit }
    });
    return res.data;
  },

  getPositions: async (logins = [], page = 1, limit = 50) => {
    const token = useAuthStore.getState().accessToken;
    const params = new URLSearchParams();
    params.append('id', token);
    params.append('page', page);
    params.append('limit', limit);
    logins.forEach(l => params.append('logins[]', l));

    const res = await api.get(`/manager/Positions?${params.toString()}`);
    return res.data;
  },

  getBrokerOrders: async (page = 1, limit = 50) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/BrokerOrders`, {
      params: { id: token, page, limit }
    });
    return res.data;
  },

  getOrders: async (logins = []) => {
    const token = useAuthStore.getState().accessToken;
    const params = new URLSearchParams();
    params.append('id', token);
    logins.forEach(l => params.append('logins[]', l));

    const res = await api.get(`/manager/Orders?${params.toString()}`);
    return res.data;
  },

  getOrderHistory: async (login, from, to) => {
    const token = useAuthStore.getState().accessToken;
    const params = { id: token, login };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await api.get(`/manager/OrderHistory`, { params });
    return res.data;
  },

  getPendingOrderHistory: async (login, from, to) => {
    const token = useAuthStore.getState().accessToken;
    const params = { id: token, login };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await api.get(`/manager/PendingOrderHistory`, { params });
    return res.data;
  },

  getBrokerDeals: async (page = 1, limit = 50) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get(`/manager/BrokerDeals`, {
      params: { id: token, page, limit }
    });
    return res.data;
  },

  // --- RBAC: ROLES (port 8091) ---
  getRoleList: async () => {
    const res = await api.get(`/ext-api/ManagerRoleList`);
    return res.data;
  },

  createRole: async (data) => {
    const res = await api.post(`/ext-api/ManagerRoleCreate`, data);
    return res.data;
  },

  updateRole: async (roleId, data) => {
    const res = await api.post(`/ext-api/ManagerRoleUpdate`, data, {
      params: { role_id: roleId }
    });
    return res.data;
  },

  deleteRole: async (roleId) => {
    const res = await api.delete(`/ext-api/ManagerRoleDelete`, {
      params: { role_id: roleId }
    });
    return res.data;
  },

  // --- RBAC: MANAGER ACCOUNTS (port 8091) ---
  getManagerList: async () => {
    const res = await api.get(`/ext-api/ManagerList`);
    return res.data;
  },

  getManagerDetail: async (login) => {
    const res = await api.get(`/ext-api/ManagerGet`, { params: { manager_login: login } });
    return res.data;
  },

  createManager: async (data) => {
    const res = await api.post(`/ext-api/ManagerCreate`, data);
    return res.data;
  },

  updateManager: async (login, params) => {
    const res = await api.get(`/ext-api/ManagerUpdate`, {
      params: { manager_login: login, ...params }
    });
    return res.data;
  },

  deleteManager: async (login) => {
    const res = await api.get(`/ext-api/ManagerDelete`, {
      params: { manager_login: login }
    });
    return res.data;
  },

  getManagerActivityLog: async (login, from, to) => {
    const params = { manager_login: login };
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get(`/ext-api/ManagerActivityLog`, { params });
    return res.data;
  },

  getManagerOnline: async () => {
    const res = await api.get(`/ext-api/ManagerOnline`);
    return res.data;
  },
};

