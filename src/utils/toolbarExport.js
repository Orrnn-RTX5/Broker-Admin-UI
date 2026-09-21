export const readVisibleTable = (root) => {
  if (!root) return { headers: [], rows: [] };
  const text = (cell) => (cell.innerText ?? cell.textContent ?? '').trim();
  const header = root.querySelector('[data-export-header], thead tr');
  if (!header) return { headers: [], rows: [] };
  const cells = Array.from(header.children);
  const indices = cells.map((cell, index) => text(cell) ? index : -1).filter((index) => index >= 0);
  const rows = Array.from(root.querySelectorAll('[data-export-row], tbody tr'))
    .filter((row) => !row.hidden && row.getAttribute('aria-hidden') !== 'true')
    .map((row) => indices.map((index) => row.children[index] ? text(row.children[index]) : ''));
  return { headers: indices.map((index) => text(cells[index])), rows };
};

export const serializeTableCsv = ({ headers, rows }) => [headers, ...rows].map((row) => row.map((value) => {
  let text = String(value ?? '');
  // Keep exported text from becoming spreadsheet formulas.
  if (/^[\s]*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}).join(',')).join('\r\n');

export const downloadText = (content, view, format) => {
  const mime = format === 'csv' ? 'text/csv' : 'application/json';
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(view || 'view').replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
