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
  }
};
