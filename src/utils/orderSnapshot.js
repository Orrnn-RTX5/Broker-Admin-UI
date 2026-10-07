import { identitySnapshotKey } from './cacheIdentity.js';
import { normalizeArrayResponse, normalizePagedResponse } from './apiShapes.js';

const keys = ['orders', 'data', 'answer', 'items', 'rows'];
const prefix = 'rtx5-orders-display:';
const fields = new Set([
  'ticket_text', 'order_ticket_text', 'ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket',
  'login', 'Login', 'accountLogin', 'account_login', 'group', 'Group', 'group_name', 'groupName',
  'timeSetupFormatted', 'timeDoneFormatted', 'timeSetup', 'TimeSetup', 'timeDone', 'TimeDone',
  'time', 'Time', 'openTime', 'OpenTime', 'closeTime', 'CloseTime',
  'symbol', 'Symbol', 'side', 'Side', 'action', 'Action', 'type', 'Type', 'cmd', 'Cmd',
  'volume', 'Volume', 'lots', 'Lots', 'volumeExt', 'VolumeExt',
  'priceOpen', 'PriceOpen', 'price_open', 'openPrice', 'OpenPrice', 'price', 'Price',
  'priceSl', 'PriceSl', 'priceSL', 'PriceSL', 'sl', 'SL',
  'priceTp', 'PriceTp', 'priceTP', 'PriceTP', 'tp', 'TP',
  'status', 'Status', 'state', 'State', 'comment', 'Comment',
]);
const scalar = value => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 4096);
const ticket = row => row.ticket_text ?? row.order_ticket_text ?? row.ticket ?? row.Ticket
  ?? row.order ?? row.Order ?? row.orderTicket ?? row.OrderTicket;
const validRow = row => row && typeof row === 'object' && !Array.isArray(row)
  && /^[1-9]\d*$/.test(String(ticket(row)))
  && !(typeof ticket(row) === 'number' && !Number.isSafeInteger(ticket(row)))
  && Object.entries(row).every(([key, value]) => fields.has(key) && scalar(value));

// A display handoff for the default first page, never a substitute for revalidation.
export const createOrderSnapshot = ({ storage = () => globalThis.sessionStorage, now = Date.now } = {}) => ({
  read(identity) {
    const key = identitySnapshotKey(prefix, identity);
    if (!key) return null;
    try {
      const raw = storage()?.getItem(key);
      if (!raw || raw.length > 512 * 1024) return null;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || saved.identity !== identity || !Number.isFinite(saved.at)
        || saved.at > now() || now() - saved.at >= 5 * 60_000
        || !Array.isArray(saved.rows) || saved.rows.length > 100 || !saved.rows.every(validRow)
        || new Set(saved.rows.map(row => String(ticket(row)))).size !== saved.rows.length
        || (saved.total !== null && (!Number.isSafeInteger(saved.total) || saved.total < saved.rows.length))) return null;
      return { orders: saved.rows, ...(saved.total !== null ? { total: saved.total } : {}) };
    } catch { return null; }
  },
  write(identity, response) {
    const key = identitySnapshotKey(prefix, identity);
    if (!key || (!Array.isArray(response) && !keys.some(key => Array.isArray(response?.[key])))) return;
    const page = normalizePagedResponse(response, { arrayKeys: keys, limit: 100, page: 1 });
    const sourceRows = normalizeArrayResponse(response, keys);
    if (sourceRows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return;
    const rows = sourceRows.map(row => Object.fromEntries(
      Object.entries(row).filter(([key, value]) => fields.has(key) && scalar(value)),
    ));
    if (rows.length > 100 || !rows.every(validRow)) return;
    try {
      const raw = JSON.stringify({ version: 1, identity, at: now(), rows, total: page.hasKnownTotal ? page.total : null });
      if (raw.length <= 512 * 1024) storage()?.setItem(key, raw);
    } catch { /* Display persistence is optional. */ }
  },
  clear(identity) {
    const key = identitySnapshotKey(prefix, identity);
    if (key) { try { storage()?.removeItem(key); } catch { /* Display persistence is optional. */ } }
  },
});
