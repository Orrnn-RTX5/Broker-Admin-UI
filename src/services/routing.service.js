import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export const RoutingService = {
  listRoutes: async (params = {}) => {
    const token = useAuthStore.getState().accessToken;
    const qs = { id: token };
    if (params.group_name) qs.group_name = params.group_name;
    if (params.lp_name)    qs.lp_name    = params.lp_name;
    if (params.enabled !== undefined) qs.enabled = params.enabled;
    const res = await api.get('/manager/GroupLPRouteList', { params: qs });
    return res.data;
  },

  getRoute: async (route_id) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get('/manager/GroupLPRouteGet', { params: { id: token, route_id } });
    return res.data;
  },

  createRoute: async (body) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/GroupLPRouteCreate?id=${token}`, body);
    return res.data;
  },

  updateRoute: async (body) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.post(`/manager/GroupLPRouteUpdate?id=${token}`, body);
    return res.data;
  },

  deleteRoute: async (route_id) => {
    const token = useAuthStore.getState().accessToken;
    const res = await api.get('/manager/GroupLPRouteDelete', { params: { id: token, route_id } });
    return res.data;
  },
};
