export default function JournalRecoveryStatus({ journal }) {
  if (!journal.delayed) return null;
  return <span className="operations-journal-recovery" role="status" aria-live="polite"
    title={journal.lastUpdatedAt ? `Showing saved events. Last successful update: ${new Date(journal.lastUpdatedAt).toLocaleTimeString()}.` : 'Waiting for the first successful journal response.'}>
    <span aria-hidden="true" className="operations-journal-recovery-dot" />
    {journal.lastUpdatedAt ? 'Updates delayed' : 'Waiting for journal'} · {journal.live ? 'reconnecting' : 'Live paused'}
  </span>;
}
