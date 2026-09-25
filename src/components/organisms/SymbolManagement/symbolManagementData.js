import { InstrumentsService } from '../../../services/instruments.service';
import { normalizeArrayResponse } from '../../../utils/apiShapes';
import { loadLpSymbols } from '../../../utils/lpSymbols';
import { lpSymbolOptions } from './symbolRows';

export const SYMBOL_MANAGEMENT_LIMIT = 5000;
const SYMBOL_OPTIONS_TIMEOUT_MS = 10000;

const DEFAULT_KEYS = ['data', 'answer', 'items', 'rows', 'value'];
const SYMBOL_KEYS = ['instruments', 'symbols', ...DEFAULT_KEYS];

export const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? undefined;

export const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => {
    settled = true;
    reject(new Error(message));
  }, timeoutMs);

  Promise.resolve(promise)
    .then((value) => {
      if (settled) return;
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      if (settled) return;
      clearTimeout(timer);
      reject(error);
    });
});

const normalizeBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'disabled', 'disable', 'off', 'hidden', 'no'].includes(normalized)) return false;
  if (['true', '1', 'enabled', 'enable', 'on', 'visible', 'yes'].includes(normalized)) return true;
  return Boolean(value);
};

const normalizeNumber = (value, fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : value;
};

const normalizeSymbolName = (row) => {
  if (typeof row === 'string') return row;
  return firstDefined(row?.symbol, row?.Symbol, row?.name, row?.Name, row?.symbol_name, row?.SymbolName) || '';
};

export const normalizeSymbolOptions = (response) =>
  normalizeArrayResponse(response, SYMBOL_KEYS)
    .map((row) => {
      const symbol = normalizeSymbolName(row);
      if (!symbol) return null;
      const source = typeof row === 'object' && row !== null ? row : {};
      const parentSymbol = firstDefined(source.parentSymbol, source.ParentSymbol, source.parent_symbol, source.parent) || '';

      return {
        ...source,
        symbol,
        name: firstDefined(source.name, source.Name, symbol),
        symbolType: firstDefined(source.symbolType, source.SymbolType, source.symbol_type) || (parentSymbol ? 'derived' : 'base'),
        parentSymbol,
        category: firstDefined(source.category, source.Category, source.path, source.Path) || '',
        enabled: normalizeBool(firstDefined(source.enabled, source.Enabled, source.enable, source.Enable), true),
      };
    })
    .filter(Boolean);

// Every LP symbol, configured or not: sessions, commission/swap, market depth
// and visibility accept any symbol text. Options carry `configured` so pickers
// can label symbols that have no instrument yet (see SymbolOptions).
export const loadSymbolOptions = async ({ force = false } = {}) => {
  const entries = await withTimeout(
    loadLpSymbols(InstrumentsService, { force }),
    SYMBOL_OPTIONS_TIMEOUT_MS,
    'symbol list request timed out'
  );

  return lpSymbolOptions(entries);
};

export const normalizeCategoryRows = (response) =>
  normalizeArrayResponse(response, ['categories', 'symbol_categories', ...DEFAULT_KEYS])
    .map((row) => {
      if (typeof row === 'string') return { id: row, name: row, parentId: '', enabled: true };
      if (!row || typeof row !== 'object') return null;

      const name = firstDefined(row.name, row.Name, row.category, row.Category);
      if (!name) return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.category_id, row.CategoryID, name),
        name,
        parentId: firstDefined(row.parentId, row.ParentId, row.parent_id, row.ParentID, row.parent, row.Parent) || '',
        path: firstDefined(row.path, row.Path) || '',
        description: firstDefined(row.description, row.Description) || '',
        enabled: normalizeBool(firstDefined(row.enabled, row.Enabled, row.enable, row.Enable), true),
      };
    })
    .filter(Boolean);

export const normalizeMappingRows = (response) =>
  normalizeArrayResponse(response, ['mappings', 'symbol_mappings', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const lpName = firstDefined(row.lpName, row.LpName, row.lp_name, row.lp, row.LPName);
      const lpSymbol = firstDefined(row.lpSymbol, row.LpSymbol, row.lp_symbol, row.external_symbol, row.ExternalSymbol);
      const internalSymbol = firstDefined(row.internalSymbol, row.InternalSymbol, row.internal_symbol, row.symbol, row.Symbol);
      if (!lpName && !lpSymbol && !internalSymbol) return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.mapping_id, index),
        lpName: lpName || '',
        lpSymbol: lpSymbol || '',
        internalSymbol: internalSymbol || '',
        enabled: normalizeBool(firstDefined(row.enabled, row.Enabled, row.active, row.Active), true),
      };
    })
    .filter(Boolean);

const normalizeDayIndex = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 && next <= 6 ? next : fallback;
};

export const normalizeSessionRows = (response) =>
  normalizeArrayResponse(response, ['sessions', 'symbol_sessions', 'trading_sessions', ...DEFAULT_KEYS])
    .map((row) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        day_of_week: normalizeDayIndex(firstDefined(row.day_of_week, row.dayOfWeek, row.day, row.Day)),
        quoteStart: firstDefined(row.quoteStart, row.QuoteStart, row.quote_start, row.quote_start_time) || '',
        quoteEnd: firstDefined(row.quoteEnd, row.QuoteEnd, row.quote_end, row.quote_end_time) || '',
        tradeStart: firstDefined(row.tradeStart, row.TradeStart, row.trade_start, row.trade_start_time) || '',
        tradeEnd: firstDefined(row.tradeEnd, row.TradeEnd, row.trade_end, row.trade_end_time) || '',
      };
    })
    .filter(Boolean);

export const normalizeOverrideRows = (response) =>
  normalizeArrayResponse(response, ['overrides', 'session_overrides', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.override_id, row.OverrideId, index),
        group: firstDefined(row.group, row.Group, row.group_name, row.groupName) || '',
        day_of_week: normalizeDayIndex(firstDefined(row.day_of_week, row.dayOfWeek, row.day, row.Day)),
        quoteStart: firstDefined(row.quoteStart, row.QuoteStart, row.quote_start, row.quote_start_time) || '',
        quoteEnd: firstDefined(row.quoteEnd, row.QuoteEnd, row.quote_end, row.quote_end_time) || '',
        tradeStart: firstDefined(row.tradeStart, row.TradeStart, row.trade_start, row.trade_start_time) || '',
        tradeEnd: firstDefined(row.tradeEnd, row.TradeEnd, row.trade_end, row.trade_end_time) || '',
      };
    })
    .filter(Boolean);

export const normalizeCommissionRows = (response) =>
  normalizeArrayResponse(response, ['schedules', 'commissions', 'commission_schedules', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.schedule_id, row.ScheduleId, index),
        name: firstDefined(row.name, row.Name) || '',
        commissionType: firstDefined(row.commissionType, row.CommissionType, row.commission_type, row.type, row.Type) || '',
        value: normalizeNumber(firstDefined(row.value, row.Value, row.amount, row.Amount), 0),
        minCharge: normalizeNumber(firstDefined(row.minCharge, row.MinCharge, row.min_charge, row.min), 0),
        maxCharge: normalizeNumber(firstDefined(row.maxCharge, row.MaxCharge, row.max_charge, row.max), 0),
      };
    })
    .filter(Boolean);

export const normalizeLeverageRows = (response) =>
  normalizeArrayResponse(response, ['tiers', 'leverage', 'dynamic_leverage', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.tier_id, row.TierId, index),
        leverage: normalizeNumber(firstDefined(row.leverage, row.Leverage), ''),
        volumeFrom: normalizeNumber(firstDefined(row.volumeFrom, row.VolumeFrom, row.volume_from, row.from), 0),
        volumeTo: normalizeNumber(firstDefined(row.volumeTo, row.VolumeTo, row.volume_to, row.to), 0),
      };
    })
    .filter(Boolean);

export const normalizeSwapFreeRows = (response) =>
  normalizeArrayResponse(response, ['groups', 'swap_free_groups', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, row.group_id, row.GroupId, row.group_name, index),
        group_name: firstDefined(row.group_name, row.groupName, row.group, row.Group) || '',
        swap_free_mode: firstDefined(row.swap_free_mode, row.swapFreeMode, row.mode, row.Mode) || '',
      };
    })
    .filter(Boolean);

export const normalizeVisibilityRows = (response) =>
  normalizeArrayResponse(response, ['visibility', 'symbol_visibility', 'rules', ...DEFAULT_KEYS])
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      return {
        ...row,
        id: firstDefined(row.id, row.ID, index),
        symbol: firstDefined(row.symbol, row.Symbol, row.symbol_name, row.SymbolName) || '',
        group: firstDefined(row.group, row.Group, row.group_name, row.groupName) || '',
        visible: normalizeBool(firstDefined(row.visible, row.Visible, row.enabled, row.Enabled), true),
      };
    })
    .filter(Boolean);

export const normalizeMarketDepthConfig = (response) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return {};
  const source = firstDefined(response.config, response.market_depth, response.marketDepth, response.data, response.answer) || response;

  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  return {
    ...source,
    depth_levels: normalizeNumber(firstDefined(source.depth_levels, source.depthLevels, source.levels), 10),
    update_interval_ms: normalizeNumber(firstDefined(source.update_interval_ms, source.updateIntervalMs, source.interval_ms), 100),
    enabled: normalizeBool(firstDefined(source.enabled, source.Enabled), true),
    aggregate: normalizeBool(firstDefined(source.aggregate, source.Aggregate), false),
  };
};
