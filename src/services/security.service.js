import { api } from '../lib/api';

export const SecurityAccessService = {
  // --- IP RESTRICTIONS ---
  listAccessRestrictions: async () => {
    const res = await api.get('/manager/AccessRestrictionList');
    return res.data;
  },
  createAccessRestriction: async (data) => {
    const res = await api.post('/manager/AccessRestrictionCreate', data);
    return res.data;
  },
  deleteAccessRestriction: async (restrictionId) => {
    const res = await api.get('/manager/AccessRestrictionDelete', { params: { restriction_id: restrictionId } });
    return res.data;
  },

  // --- CONNECTION THROTTLE ---
  listConnectionThrottle: async () => {
    const res = await api.get('/manager/ConnectionThrottleList');
    return res.data;
  },
  createConnectionThrottle: async (data) => {
    const res = await api.post('/manager/ConnectionThrottleCreate', data);
    return res.data;
  },
  deleteConnectionThrottle: async (throttleId) => {
    const res = await api.get('/manager/ConnectionThrottleDelete', { params: { throttle_id: throttleId } });
    return res.data;
  },

  // --- LOG MANAGEMENT ---
  getLogLevel: async () => {
    const res = await api.get('/manager/LogLevelGet');
    return res.data;
  },
  setLogLevel: async (level) => {
    const res = await api.get('/manager/LogLevelSet', { params: { level } });
    return res.data;
  },
  flushLogs: async () => {
    const res = await api.get('/manager/LogFlush');
    return res.data;
  },

  // --- BACKUP SCHEDULES ---
  listBackupSchedules: async () => {
    const res = await api.get('/manager/BackupScheduleList');
    return res.data;
  },
  createBackupSchedule: async (data) => {
    const res = await api.post('/manager/BackupScheduleCreate', data);
    return res.data;
  },
  deleteBackupSchedule: async (scheduleId) => {
    const res = await api.get('/manager/BackupScheduleDelete', { params: { schedule_id: scheduleId } });
    return res.data;
  },
  listBackupHistory: async (params = {}) => {
    const res = await api.get('/manager/BackupHistoryList', { params });
    return res.data;
  },

  // --- PLUGIN MANAGEMENT ---
  listPlugins: async () => {
    const res = await api.get('/manager/PluginList');
    return res.data;
  },
  installPlugin: async (data) => {
    const res = await api.post('/manager/PluginInstall', data);
    return res.data;
  },
  togglePlugin: async (pluginId, enabled) => {
    const res = await api.get('/manager/PluginToggle', { params: { plugin_id: pluginId, enabled } });
    return res.data;
  },
  uninstallPlugin: async (pluginId) => {
    const res = await api.get('/manager/PluginUninstall', { params: { plugin_id: pluginId } });
    return res.data;
  },
};
