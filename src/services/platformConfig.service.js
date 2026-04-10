import { api } from '../lib/api';

// All endpoints hit port 8091 via the /ext-api proxy
const EXT = '/ext-api';

export const PlatformConfigService = {
  // --- Custom Fields ---
  createCustomField: (body) =>
    api.post(`${EXT}/CustomFieldCreate`, body).then(r => r.data),

  deleteCustomField: (field_id) =>
    api.get(`${EXT}/CustomFieldDelete`, { params: { field_id } }).then(r => r.data),

  listCustomFields: (entity_type = 'account') =>
    api.get(`${EXT}/CustomFieldList`, { params: { entity_type } }).then(r => r.data),

  getCustomFieldValue: (field_id, entity_id) =>
    api.get(`${EXT}/CustomFieldValueGet`, { params: { field_id, entity_id } }).then(r => r.data),

  setCustomFieldValue: (field_id, entity_id, value) =>
    api.get(`${EXT}/CustomFieldValueSet`, { params: { field_id, entity_id, value } }).then(r => r.data),

  // --- Feature Flags ---
  listFeatureFlags: (group) =>
    api.get(`${EXT}/FeatureFlagList`, { params: group ? { group } : {} }).then(r => r.data),

  setFeatureFlag: (body) =>
    api.post(`${EXT}/FeatureFlagSet`, body).then(r => r.data),

  // --- Symbol Visibility ---
  getSymbolVisibility: (group) =>
    api.get(`${EXT}/SymbolVisibilityGet`, { params: { group } }).then(r => r.data),

  listSymbolVisibility: () =>
    api.get(`${EXT}/SymbolVisibilityList`).then(r => r.data),

  setSymbolVisibility: (group, symbols) =>
    api.post(`${EXT}/SymbolVisibilitySet`, { group, symbols }).then(r => r.data),

  // --- Trading Terminal Config ---
  getTradingTerminalConfig: (group) =>
    api.get(`${EXT}/TradingTerminalConfigGet`, { params: { group } }).then(r => r.data),

  setTradingTerminalConfig: (body) =>
    api.post(`${EXT}/TradingTerminalConfigSet`, body).then(r => r.data),
};
