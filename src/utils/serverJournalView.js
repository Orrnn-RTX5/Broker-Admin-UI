import { formatServerJournalTime, serverJournalLogin } from './serverJournal.js';

export const JOURNAL_COLUMN_WIDTHS = Object.freeze({ Time: 184, Type: 86, Source: 120, Action: 132, Login: 78, Group: 170, Message: 302 });

export const journalEntryKey = entry => String(entry.id ?? JSON.stringify([entry.time, entry.source, entry.action, entry.message]));

// Copy the complete record, including columns currently hidden in the grid.
export const journalEntryText = entry => [
  formatServerJournalTime(entry.time), entry.severity, entry.source, entry.action,
  serverJournalLogin(entry), entry.group || '—', entry.message,
].map(value => String(value ?? '—').replace(/\r?\n/g, ' ')).join('\t');

export const journalMinimumWidth = columns => 28 + columns.reduce((width, label) => width + JOURNAL_COLUMN_WIDTHS[label], 0);

export const newestJournalEntry = entries => entries.reduce((newest, entry) => !newest || Number(entry.time) > Number(newest.time) ? entry : newest, null);

export async function copyJournalEntry(entry) {
  const text = journalEntryText(entry);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch { /* Older desktop shells can use the selected-text fallback. */ }
  const previousFocus = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try { copied = document.execCommand('copy'); }
  finally { input.remove(); previousFocus?.focus({ preventScroll: true }); }
  if (!copied) throw new Error('Clipboard access was denied. Try copying again.');
}
