const numberFormatters = new Map();

/** Display only: keep the original order values available for details and export. */
export const formatOrderNumber = (value, digits, minimumDigits = 0) => {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const explicit = digits !== null && digits !== undefined && String(digits).trim() !== '' ? Number(digits) : NaN;
  const hasPrecision = Number.isInteger(explicit) && explicit >= 0 && explicit <= 20;
  const maxDigits = hasPrecision ? explicit : 20;
  const minDigits = hasPrecision ? explicit : Math.min(minimumDigits, maxDigits);
  const key = `${minDigits}:${maxDigits}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat('en-US', {
    useGrouping: false, minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits,
  }));
  // Backend precision takes priority. Without metadata, remove binary float noise.
  return numberFormatters.get(key).format(hasPrecision ? value : Number(number.toPrecision(15)));
};

export const formatOrderTime = (timestampMs, fallback = '—') => {
  if (!Number.isFinite(timestampMs)) return fallback || '—';
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return fallback || '—';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
