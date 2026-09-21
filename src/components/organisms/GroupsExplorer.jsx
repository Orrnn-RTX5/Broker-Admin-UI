import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUp, ChevronRight, FileText, Folder, Pencil } from 'lucide-react';
import { useDataFetch } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { ManagerService } from '../../services/manager.service';
import { AccountsService } from '../../services/accounts.service';
import { canAccessView } from '../../utils/permissions';
import { useDummyGroupsStore } from '../../store/useDummyGroupsStore';
import DummyGroupsExplorer from './DummyGroupsExplorer';
import {
  GROUPS_ROOT_NODE,
  GROUPS_ADMIN_NODE,
  filterGroupsExplorerNodes,
  getGroupsExplorerColumns,
  getGroupsExplorerEditTarget,
  getGroupsExplorerRow,
  loadGroupsExplorerNodes,
} from '../../utils/groupsExplorerData';

const EMPTY_NODES = [];
const ROOT_NODES = [GROUPS_ADMIN_NODE];
const ROOT_LOCATION = { type: 'root' };

const GroupsExplorerFolder = ({
  location,
  onNavigate,
  onAccountOpen,
  onGroupEdit,
  onSelectionChange,
  onCountChange,
  onRowsChange,
  selectedNodeId,
  searchQuery = '',
  sortDirection = 'asc',
  refreshTrigger,
}) => {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const canLoadGroups = isAuthenticated && canAccessView(user, 'Groups');
  const canLoadAccounts = canLoadGroups && canAccessView(user, 'Trading Accounts');
  const isAccountFolder = location.type === 'group';
  const canRead = isAccountFolder ? canLoadAccounts : canLoadGroups;
  const [selection, setSelection] = useState(null);
  const fetchNodes = useCallback(() => loadGroupsExplorerNodes(location, {
    getGroups: ManagerService.getGroupList,
    getAccounts: AccountsService.getAccounts,
  }), [location]);
  const { data, loading: fetching, error, mutate } = useDataFetch(
    fetchNodes, null, [location.type, location.groupName, refreshTrigger], canRead && location.type !== 'root',
  );
  const loading = location.type !== 'root' && fetching && canRead;
  const nodes = !canRead || loading || error ? EMPTY_NODES : location.type === 'root' ? ROOT_NODES : data || EMPTY_NODES;
  const visibleNodes = useMemo(() => filterGroupsExplorerNodes(nodes, searchQuery, sortDirection), [nodes, searchQuery, sortDirection]);
  const rows = useMemo(() => visibleNodes.map(getGroupsExplorerRow), [visibleNodes]);
  const columns = useMemo(() => getGroupsExplorerColumns(location, nodes), [location, nodes]);
  const effectiveSelectedId = selection && selection.sidebarId === selectedNodeId ? selection.id : selectedNodeId;
  const selectedNode = visibleNodes.find(node => node.id === effectiveSelectedId);
  const selectedTarget = useMemo(() => selectedNode ? getGroupsExplorerEditTarget(selectedNode) : null, [selectedNode]);
  const noun = isAccountFolder ? 'accounts' : 'groups';

  useEffect(() => {
    onSelectionChange?.(selectedTarget);
  }, [onSelectionChange, selectedTarget]);

  useEffect(() => {
    onRowsChange?.(rows);
    onCountChange?.({ total: nodes.length, filtered: rows.length, visible: rows.length, bytes: new TextEncoder().encode(JSON.stringify(rows)).length });
  }, [nodes.length, onCountChange, onRowsChange, rows]);

  const navigate = (node) => {
    onSelectionChange?.(null);
    onNavigate?.(node);
  };
  const select = (node) => setSelection({ id: node.id, sidebarId: selectedNodeId });
  const activate = (node) => {
    if (node.type === 'group-account') onAccountOpen?.(node);
    else navigate(node);
  };
  const parentNode = isAccountFolder ? GROUPS_ADMIN_NODE : GROUPS_ROOT_NODE;
  const crumbs = [GROUPS_ROOT_NODE, ...(location.type !== 'root' ? [GROUPS_ADMIN_NODE] : []), ...(isAccountFolder ? [{ type: 'group', id: `group:${location.groupName}`, label: location.groupName, groupName: location.groupName, group: location.group }] : [])];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[color:var(--bg-app)] text-[color:var(--text-primary)]" aria-label="Groups explorer">
      <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-2">
        <button type="button" aria-label="Up one folder" title="Up one folder" disabled={location.type === 'root'} onClick={() => navigate(parentNode)} className="rounded p-1 hover:bg-[color:var(--bg-surface-3)] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-600)]">
          <ArrowUp size={14} />
        </button>
        <nav aria-label="Group folder path" className="min-w-0 flex-1 overflow-x-auto">
          <ol className="flex items-center gap-1 whitespace-nowrap text-[11px]">
            {crumbs.map((crumb, index) => (
              <li key={crumb.id} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} aria-hidden="true" className="text-[color:var(--text-muted)]" />}
                <button type="button" aria-current={index === crumbs.length - 1 ? 'page' : undefined} onClick={() => navigate(crumb)} className="rounded px-1.5 py-1 hover:bg-[color:var(--bg-surface-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-600)]">{crumb.label}</button>
              </li>
            ))}
          </ol>
        </nav>
        {selectedNode?.type === 'group' && onGroupEdit && (
          <button type="button" onClick={() => onGroupEdit({ ...selectedNode, group: selectedTarget.row })} className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-[color:var(--bg-surface-3)]">
            <Pencil size={12} /> Properties
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" aria-busy={loading}>
        <table className="w-full border-collapse text-left text-[11px]" aria-label={isAccountFolder ? `Accounts in ${location.groupName}` : location.type === 'root' ? 'Group folders' : 'Groups in Admin'}>
          <thead className="sticky top-0 z-10 bg-[color:var(--bg-surface-1)]">
            <tr>{columns.map(column => (
              <th key={column.key} scope="col" className={`border-b border-r border-[color:var(--border-default)] px-2 py-1 font-medium last:border-r-0 ${column.primary ? 'min-w-52' : 'min-w-24'} ${column.numeric ? 'text-right' : ''}`}>{column.label}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visibleNodes.map((node, index) => {
              const Icon = node.type === 'group-account' ? FileText : Folder;
              const selected = effectiveSelectedId === node.id;
              return (
                <tr key={node.id} data-node-id={node.id} tabIndex={0} aria-selected={selected} onClick={() => select(node)} onFocus={() => select(node)} onDoubleClick={() => activate(node)} onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); activate(node); }
                  if (event.key === ' ') { event.preventDefault(); select(node); }
                }} className={`cursor-default border-b border-[color:var(--border-default)] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--accent-600)] ${selected ? 'bg-[color:var(--accent-soft)]' : 'even:bg-[color:var(--bg-surface-1)] hover:bg-[color:var(--bg-surface-2)]'}`}>
                  {columns.map(column => (
                    <td key={column.key} className={`border-r border-[color:var(--border-default)] px-2 py-1 last:border-r-0 ${column.numeric ? 'text-right tabular-nums' : ''}`}>
                      {column.primary ? <span className="flex items-center gap-1.5"><Icon size={14} aria-hidden="true" className={`shrink-0 ${node.type === 'group-account' ? 'text-[color:var(--accent-600)]' : 'text-amber-500'}`} /><span className="whitespace-nowrap">{rows[index][column.key]}</span></span> : <span className="whitespace-nowrap">{rows[index][column.key] === '' ? '' : String(rows[index][column.key])}</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!canRead ? <p role="alert" className="p-4 text-[12px] text-[color:var(--text-muted)]">{canLoadGroups ? 'Account access required to open this folder.' : 'Group access required.'}</p>
          : loading ? <p role="status" className="p-4 text-[12px] text-[color:var(--text-muted)]">Loading {noun}...</p>
            : error ? <div role="alert" className="p-4 text-[12px] text-[color:var(--text-muted)]">Unable to load {noun}. <button type="button" onClick={mutate} className="text-[color:var(--accent-600)] underline">Retry</button></div>
              : !visibleNodes.length ? <p role="status" className="p-4 text-[12px] text-[color:var(--text-muted)]">{searchQuery.trim() ? `No ${noun} match your search.` : isAccountFolder ? 'No accounts in this group.' : 'No groups available.'}</p> : null}
      </div>
    </section>
  );
};

// A new location owns its selection and request state, so records from the
// previous folder cannot flash while the next folder is loading.
const GroupsExplorer = ({ location = ROOT_LOCATION, ...props }) => {
  const mode = useDummyGroupsStore(state => state.mode);
  const setMode = useDummyGroupsStore(state => state.setMode);
  return <>
    <div className="dummy-group-source">
      <label>Data source <select aria-label="Groups data source" value={mode} onChange={event => {
        props.onSelectionChange?.(null);
        props.onNavigate?.(GROUPS_ROOT_NODE);
        setMode(event.target.value);
      }}><option value="dummy">Dummy data</option><option value="server">Server data</option></select></label>
      {mode === 'dummy' ? <><strong>Dummy workspace</strong><span>All marked values are examples. Changes are saved in this browser.</span></> : <span>Groups and accounts from the connected server.</span>}
    </div>
    {mode === 'dummy'
      ? <DummyGroupsExplorer key={location.id || location.type} location={location} {...props} />
      : <GroupsExplorerFolder key={`${location.type}:${location.groupName || ''}`} location={location} {...props} />}
  </>;
};

export default GroupsExplorer;
