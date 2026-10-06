import { api } from '../lib/api';
import { closeManagerPosition } from './managerTradeApi.js';

export const PositionsService = {
  getPositions: async (params) => {
    const res = await api.get('/api/v2/admin/positions', { params });
    return res.data;
  },

  getExposure: async (symbol) => {
    const res = await api.get('/api/v2/admin/exposure', { params: { symbol } });
    return res.data;
  },

  closeAll: async (filters) => {
    const symbol=String(filters?.symbol||'').trim();
    if(!symbol)throw new Error('A symbol is required.');
    const response=await api.get('/api/v1/manager/trade-close-targets',{params:{symbol}});
    const {targets,truncated}=response.data||{};
    if(!Array.isArray(targets)||truncated||targets.length>200)throw new Error('Close-all requires at most 200 authorized positions. Narrow the scope before submitting.');
    if(targets.some(row=>row.symbol!==symbol||!row.position_ticket||!row.account_login))throw new Error('Invalid authorized position snapshot.');
    let closed=0;
    for(const target of targets){
      try{await closeManagerPosition(target.position_ticket,{account_login:target.account_login,volume:0});closed++;}
      catch(error){throw Object.assign(new Error(`${closed} positions confirmed closed. ${error.message}`),{cause:error,positions_closed:closed,client_order_id:error.client_order_id,statusUnknown:error.statusUnknown});}
    }
    return {positions_closed:closed};
  },

  getTopAccounts: async (params) => {
    const res = await api.get('/api/v2/admin/top-accounts', { params });
    return res.data;
  },

  getDealSummary: async (params) => {
    const res = await api.get('/api/v2/admin/deals/summary', { params });
    return res.data;
  }
};
