// Validate-only import helpers (SUI-A8).
// File → Validate import file never imports anything: it only parses the file
// and reports the row count. These pure helpers keep that honestly labeled.
export const parseImportFile = (text) => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('file is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : null;
    if (!rows) throw new Error('JSON has no rows array');
    return { format: 'JSON', view: parsed?.view || null, count: rows.length };
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row');
  return { format: 'CSV', view: null, count: lines.length - 1 };
};

export const buildImportValidationToast = (summary, fileName) => ({
  title: 'Import file validated — nothing imported',
  description: `${summary.format}: ${summary.count} rows in ${fileName}${summary.view ? ` (view: ${summary.view})` : ''} — validation only, no data was imported.`,
  tone: 'info',
});

export const buildImportFailureToast = (fileName, err) => ({
  title: 'Import failed',
  description: `${fileName}: ${err.message}`,
  tone: 'danger',
});
