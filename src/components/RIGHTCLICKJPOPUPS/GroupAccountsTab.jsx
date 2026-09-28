import { useCallback, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useDataFetch } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { AccountsService } from '../../services/accounts.service';
import { canAccessView } from '../../utils/permissions';
import { getGroupsExplorerRow, loadGroupsExplorerNodes } from '../../utils/groupsExplorerData';

const COLUMNS = [
  { key: 'login', label: 'Login' },
  { key: 'name', label: 'Name' },
  { key: 'balance', label: 'Balance', numeric: true },
  { key: 'equity', label: 'Equity', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
];

const money = (value) => {
  const number = Number(value);
  return value === '' || !Number.isFinite(number)
    ? String(value ?? '')
    : number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const cellText = (column, row) => (column.numeric ? money(row[column.key]) : String(row[column.key] ?? ''));

// Every account whose group is exactly this group, across all server pages.
const GroupAccountsTab = ({ groupName, onOpenAccount }) => {
  const user = useAuthStore(state => state.user);
  const canLoadAccounts = canAccessView(user, 'Trading Accounts');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const fetchAccounts = useCallback(() => loadGroupsExplorerNodes(
    { type: 'group', groupName },
    { getAllAccounts: AccountsService.getAllAccounts },
  ), [groupName]);
  const { data, loading, error, mutate: refetch } = useDataFetch(fetchAccounts, null, [groupName], Boolean(groupName) && canLoadAccounts);
  // Reload means a fresh server read, not the shared account list cached a moment ago.
  const mutate = () => {
    AccountsService.invalidateCache();
    return refetch();
  };

  const rows = useMemo(() => (data || []).map(node => ({ node, ...getGroupsExplorerRow(node) })), [data]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row => COLUMNS.some(column => String(row[column.key] ?? '').toLowerCase().includes(query)));
  }, [rows, search]);

  const message = !canLoadAccounts
    ? 'Account access required to list this group\'s accounts.'
    : loading ? 'Loading accounts...'
      : error ? null
        : search.trim() && !visibleRows.length ? 'No accounts match your search.'
          : !visibleRows.length ? 'There are no accounts in this group.' : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input
            aria-label="Find account"
            placeholder="Find account..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm pl-6 pr-2 py-1 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        <span className="text-[11px] text-[color:var(--text-muted)] tabular-nums" role="status">
          {loading ? '' : `${visibleRows.length} of ${rows.length} accounts`}
        </span>
        <button
          type="button"
          title="Reload accounts"
          aria-label="Reload accounts"
          disabled={!canLoadAccounts || loading}
          onClick={() => mutate()}
          className="p-1.5 rounded-sm border border-[color:var(--border-default)] text-[color:var(--text-muted)] hover:text-white disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>

      <div className="border border-[color:var(--border-default)] rounded-sm max-h-[300px] overflow-auto custom-scrollbar">
        <table className="w-full text-[11px]" aria-label={`Accounts in ${groupName}`}>
          <thead className="sticky top-0 bg-[color:var(--bg-surface-2)]">
            <tr>
              {COLUMNS.map(column => (
                <th key={column.key} scope="col" className={`px-2 py-1 font-medium text-[color:var(--text-secondary)] ${column.numeric ? 'text-right' : 'text-left'}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!message && !error && visibleRows.map(row => (
              <tr
                key={row.node.id}
                tabIndex={0}
                aria-selected={selectedId === row.node.id}
                onClick={() => setSelectedId(row.node.id)}
                onDoubleClick={() => onOpenAccount?.(row.node.account)}
                onKeyDown={event => { if (event.key === 'Enter') onOpenAccount?.(row.node.account); }}
                className={`cursor-default border-t border-white/5 ${selectedId === row.node.id ? 'bg-blue-500/20' : 'hover:bg-white/5'}`}
              >
                {COLUMNS.map(column => (
                  <td key={column.key} className={`px-2 py-1 text-[color:var(--text-primary)] ${column.numeric ? 'text-right tabular-nums' : ''}`}>
                    {cellText(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {message && <p role="status" className="p-4 text-center text-[11px] text-[color:var(--text-muted)]">{message}</p>}
        {error && !loading && (
          <div role="alert" className="p-4 text-center text-[11px] text-[color:var(--text-muted)]">
            Unable to load accounts.{' '}
            <button type="button" className="underline text-white" onClick={() => mutate()}>Retry</button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-[color:var(--text-muted)]">Double-click an account to open it.</p>
    </div>
  );
};

export default GroupAccountsTab;
