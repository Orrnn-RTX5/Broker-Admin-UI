import { api } from '../lib/api';

export const RoutingService = {
  listRoutes: async (params = {}) => {
    const qs = {};
    if (params.group_name) qs.group_name = params.group_name;
    if (params.lp_name)    qs.lp_name    = params.lp_name;
    if (params.enabled !== undefined) qs.enabled = params.enabled;
    const res = await api.get('/manager/GroupLPRouteList', { params: qs });
    return res.data;
  },

  getRoute: async (route_id) => {
    const res = await api.get('/manager/GroupLPRouteGet', { params: { route_id } });
    return res.data;
  },

  createRoute: async (body) => {
    const res = await api.post('/manager/GroupLPRouteCreate', body);
    return res.data;
  },

  updateRoute: async (body) => {
    const res = await api.post('/manager/GroupLPRouteUpdate', body);
    return res.data;
  },

  deleteRoute: async (route_id) => {
    const res = await api.get('/manager/GroupLPRouteDelete', { params: { route_id } });
    return res.data;
  },
};
