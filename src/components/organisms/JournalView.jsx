import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import useServerJournal from '../../hooks/useServerJournal';
import { serverJournalSessionKey } from '../../utils/serverJournal';
import ServerJournal from './ServerJournal';

// Main-area broker journal (SUI-A3). Window-menu and header Journal entries
// previously fell through to the empty group-lookup state because no main
// renderer existed. This view reuses the exact surface and data layer as the
// Operations Terminal dock (ServerJournal + useServerJournal over the same
// fetchServerJournal data layer): no new backend calls, no placeholder data.
export default function JournalView() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [query, setQuery] = useState('');
  const journalSession = serverJournalSessionKey(user);
  const journal = useServerJournal(isAuthenticated, journalSession, true);
  const status = !isAuthenticated
    ? 'Sign in to view journal'
    : journal.error || (journal.loading && journal.entries.length === 0 ? 'Loading journal…' : '');

  return (
    <div className="admin-journal-view">
      <div className="admin-journal-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search journal"
          aria-label="Search journal"
          className="admin-journal-search"
        />
        {status ? <span role="status">{status}</span> : null}
      </div>
      <ServerJournal journal={journal} query={query} isAuthenticated={isAuthenticated} />
    </div>
  );
}
