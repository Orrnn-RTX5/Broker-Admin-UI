const formatters = new Map();

/** Display precision follows account metadata, then the currency's minor units. */
export const formatAccountAmount = (value, currency, currencyDigits) => {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const code = String(currency || '').trim().toUpperCase();
  const explicitDigits = currencyDigits !== null && currencyDigits !== undefined && String(currencyDigits).trim() !== ''
    ? Number(currencyDigits) : NaN;
  const digitsKey = Number.isInteger(explicitDigits) && explicitDigits >= 0 && explicitDigits <= 20 ? explicitDigits : 'currency';
  const key = `${code}:${digitsKey}`;
  if (!formatters.has(key)) {
    let digits = digitsKey;
    if (digits === 'currency') {
      try { digits = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; }
      catch { digits = 2; }
    }
    formatters.set(key, new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return formatters.get(key).format(amount);
};
