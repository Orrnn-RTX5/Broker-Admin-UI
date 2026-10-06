import { canManageGroupLifecycle } from '../../utils/groupAccess';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUp, ChevronRight, Folder, Info, Pencil, Plus, Search, Trash2, User, Users, X } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { useDataFetch } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { ManagerService } from '../../services/manager.service';
import { AccountsService } from '../../services/accounts.service';
import { canAccessView } from '../../utils/permissions';
import { loadGroupTreePages } from '../../utils/groupTreeData';
import { GROUP_LIST_ARRAY_KEYS, GROUP_LIST_FETCH_OPTIONS, loadGroupList, readGroupListSnapshot } from '../../utils/groupListCache';
import './DummyGroupsExplorer.css';
import './GroupsExplorer.css';
import {
  GROUPS_ROOT_NODE,
  filterGroupsExplorerNodes,
  getGroupsExplorerColumns,
  getGroupsExplorerEditTarget,
  getGroupsExplorerRow,
  getServerGroupCount,
  getServerGroupFolderNodes,
  getServerGroupParentPath,
  loadGroupsExplorerNodes,
} from '../../utils/groupsExplorerData';

const EMPTY_NODES = [];
const SELECT_STYLE = { padding: 7, border: '1px solid var(--border-default)', background: 'var(--bg-app)', color: 'var(--text-primary)' };
const ROOT_LOCATION = { type: 'root' };
const SEPARATOR = '\\';
const ADMIN_LOCATION = { type: 'admin' };

const YellowFolderIcon = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="dummy-icon-folder" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const GroupIcon = (props) => (
  <Users size={14} className="dummy-icon-group" {...props} />
);

const AccountIcon = (props) => (
  <User size={14} className="dummy-icon-account" {...props} />
);

const folderNode = (path) => (path
  ? { type: 'server-folder', id: `server-folder:${path}`, label: path.split(SEPARATOR).at(-1), path }
  : GROUPS_ROOT_NODE);
const isLeafNode = (node) => node.type === 'group' || node.type === 'group-account';
const hasSubgroups = (node) => node.type === 'group' && node.count > 0;
const isBranch = (node) => node.type === 'server-folder' || hasSubgroups(node);
const nodeIcon = (node) => (node.type === 'group-account' ? AccountIcon : node.type === 'group' && !hasSubgroups(node) ? GroupIcon : YellowFolderIcon);
const cellText = (value) => (value === '' || value === undefined || value === null ? '' : String(value));
const formatAmount = (value) => {
  const text = cellText(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return text;
  const [integer, fraction] = text.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction === undefined ? '' : `.${fraction}`}`;
};

const ServerGroupsExplorer = ({
  location,
  onNavigate,
  onAccountOpen,
  onAccountGroupOpen,
  onGroupEdit,
  onGroupCreate,
  onGroupDelete,
  deleting = false,
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
  const canLifecycle=canManageGroupLifecycle(user);
  const canLoadAccounts = canLoadGroups && canAccessView(user, 'Trading Accounts');
  const isAccountFolder = location.type === 'group';
  // Main groups sit directly under Groups; the old "Admin" location is just the root.
  const isRoot = location.type === 'root' || location.type === 'admin';
  // Every row at the Groups root is a main group, i.e. a folder, even before it has subgroups.
  const rowIsBranch = (node) => isBranch(node) || (isRoot && node.type === 'group');
  const folderPath = location.type === 'server-folder' ? location.path : isAccountFolder ? getServerGroupParentPath(location.groupName) : '';
  const canRead = isAccountFolder ? canLoadAccounts : canLoadGroups;
  // Per-folder UI state lives in one object keyed by the location, so opening a
  // folder resets it during render instead of remounting the whole explorer.
  const locationKey = `${location.type}:${location.path || location.groupName || ''}`;
  const freshView = { key: locationKey, selection: null, allGroups: false, subgroupDraft: null, localSearch: '' };
  const [storedView, setView] = useState(freshView);
  if (storedView.key !== locationKey) setView(freshView);
  const view = storedView.key === locationKey ? storedView : freshView;
  const { selection, allGroups, subgroupDraft, localSearch } = view;
  const setSelection = (next) => setView(current => ({ ...current, selection: next }));
  const setAllGroups = (next) => setView(current => ({ ...current, allGroups: next }));
  const setSubgroupDraft = (next) => setView(current => ({ ...current, subgroupDraft: typeof next === 'function' ? next(current.subgroupDraft) : next }));
  const setLocalSearch = (next) => setView(current => ({ ...current, localSearch: next }));
  const [menuNode, setMenuNode] = useState(null);
  const fetchGroups = useCallback(() => loadGroupList(() => loadGroupTreePages(
    ManagerService.getGroupList,
    { arrayKeys: GROUP_LIST_ARRAY_KEYS },
  )), []);
  const { data: groupData, loading: fetchingGroups, error: groupError, mutate: retryGroups } = useDataFetch(
    fetchGroups, null, [refreshTrigger], canLoadGroups, GROUP_LIST_FETCH_OPTIONS,
  );
  // The stored snapshot paints the tree instantly while the live list is still loading.
  const snapshot = useMemo(() => (groupData ? null : readGroupListSnapshot()), [groupData]);
  const groupList = groupData ?? snapshot;
  const groupNodes = useMemo(() => (groupList ? groupList.map(group => ({ ...group, type: 'group' })) : EMPTY_NODES), [groupList]);
  // An opened folder that is itself a server group (every main group) also holds accounts.
  const folderGroupName = location.type === 'server-folder'
    ? groupNodes.find(group => group.groupName.toLowerCase() === location.path.toLowerCase())?.groupName || ''
    : '';
  const accountGroupName = isAccountFolder ? location.groupName : folderGroupName;
  const loadsAccounts = canLoadAccounts && Boolean(accountGroupName);
  // Account rows are tagged with their group so a previous folder's rows never show under a new one.
  const fetchAccounts = useCallback(async () => ({
    groupName: accountGroupName,
    nodes: await loadGroupsExplorerNodes({ type: 'group', groupName: accountGroupName }, {
      getAllAccounts: AccountsService.getAllAccounts,
    }),
  }), [accountGroupName]);
  const { data: accountData, loading: fetchingAccounts, error: accountError, mutate: retryAccounts } = useDataFetch(
    fetchAccounts, null, [accountGroupName, refreshTrigger], loadsAccounts,
  );
  const accountsReady = loadsAccounts && accountData?.groupName === accountGroupName;
  const accountsPending = loadsAccounts && !accountsReady && !accountError;
  const loading = (canLoadGroups && fetchingGroups && !groupList) || (!allGroups && loadsAccounts && (fetchingAccounts || accountsPending));
  const error = (groupError && !groupList) || (!allGroups && loadsAccounts && accountError);
  const accountNodes = accountsReady ? accountData.nodes : EMPTY_NODES;
  const folderNodes = useMemo(() => getServerGroupFolderNodes(groupNodes, folderPath), [groupNodes, folderPath]);
  const folderContents = useMemo(() => [...folderNodes, ...accountNodes], [folderNodes, accountNodes]);
  const baseNodes = allGroups ? groupNodes : isAccountFolder ? accountNodes : folderContents;
  const nodes = !canRead || loading || error ? EMPTY_NODES : baseNodes;
  // Folders first, then groups, then accounts.
  const visibleNodes = useMemo(() => {
    const filtered = filterGroupsExplorerNodes(nodes, searchQuery, sortDirection);
    const searched = localSearch.trim() ? filterGroupsExplorerNodes(filtered, localSearch, sortDirection) : filtered;
    return [
      ...searched.filter(node => !isLeafNode(node)),
      ...searched.filter(node => node.type === 'group'),
      ...searched.filter(node => node.type === 'group-account'),
    ];
  }, [nodes, searchQuery, sortDirection, localSearch]);
  const rows = useMemo(() => visibleNodes.map(getGroupsExplorerRow), [visibleNodes]);
  const columns = useMemo(
    () => getGroupsExplorerColumns(allGroups || !isAccountFolder ? ADMIN_LOCATION : location, nodes),
    [allGroups, isAccountFolder, location, nodes],
  );
  const effectiveSelectedId = selection && selection.sidebarId === selectedNodeId ? selection.id : selectedNodeId;
  const selectedNode = visibleNodes.find(node => node.id === effectiveSelectedId);
  const selectedTarget = useMemo(() => (selectedNode ? getGroupsExplorerEditTarget(selectedNode) : null), [selectedNode]);
  const noun = allGroups ? 'groups' : isAccountFolder ? 'accounts' : folderGroupName ? 'groups and accounts' : 'groups';
  const groupCount = groupNodes.length;
  const folderCount = isAccountFolder ? accountNodes.length : getServerGroupCount(groupNodes, folderPath);
  const serverPath = isAccountFolder ? location.groupName : folderPath;
  const listTitle = allGroups ? 'All groups' : isAccountFolder ? location.groupName : isRoot ? 'Group directory' : serverPath;
  const listType = allGroups || !isAccountFolder ? 'GROUP DIRECTORY' : 'GROUP ACCOUNTS';
  const countLabel = loading ? `Loading ${noun}...` : `${visibleNodes.length}${visibleNodes.length !== nodes.length ? ` of ${nodes.length}` : ''} ${noun}`;

  useEffect(() => {
    onSelectionChange?.(selectedTarget);
  }, [onSelectionChange, selectedTarget]);

  useEffect(() => {
    onRowsChange?.(rows);
    onCountChange?.({ total: nodes.length, filtered: rows.length, visible: rows.length, bytes: new TextEncoder().encode(JSON.stringify(rows)).length });
  }, [nodes.length, onCountChange, onRowsChange, rows]);

  const navigate = (node) => {
    setSelection(null);
    setAllGroups(false);
    setMenuNode(null);
    onSelectionChange?.(null);
    onNavigate?.(node);
  };
  const select = (node) => setSelection({ id: node.id, sidebarId: selectedNodeId });
  const openSettings = (node) => {
    const target = getGroupsExplorerEditTarget(node);
    if (target) onGroupEdit?.({ ...node, group: target.row });
  };
  // An account opens its group's properties (Margin / Symbols / Commissions), like MT5 Manager.
  const openAccountGroup = (node) => {
    const groupName = node.account?.group || node.groupName || '';
    const record = groupNodes.find(group => group.groupName.toLowerCase() === String(groupName).toLowerCase());
    const name = record?.groupName || groupName;
    if (name) onAccountGroupOpen?.({ ...(record?.group && typeof record.group === 'object' ? record.group : {}), group: name });
  };
  // Folders and main groups open; a client group (no subgroups) opens its properties.
  const activate = (node) => {
    if (node.type === 'group-account') openAccountGroup(node);
    else if (node.type === 'group' && (allGroups || !rowIsBranch(node))) openSettings(node);
    else if (node.type === 'group') navigate(folderNode(node.groupName));
    else navigate(node);
  };
  // New groups always nest inside the folder or group they are created from.
  const currentContainer = isAccountFolder ? location.groupName : folderPath;
  const containerOf = (node) => (node.type === 'server-folder' ? node.path : node.type === 'group' ? node.groupName : '');
  const canContain = (node) => Boolean(node) && node.type !== 'group-account';
  const addGroup = (parent = currentContainer) => onGroupCreate?.(parent ? { name: `${parent}${SEPARATOR}` } : undefined);
  const branchNames = (path) => groupNodes
    .filter(group => group.groupName.toLowerCase() === path.toLowerCase() || group.groupName.toLowerCase().startsWith(`${path.toLowerCase()}${SEPARATOR}`))
    .map(group => group.groupName);
  const canDelete = (node) => canLifecycle && Boolean(node) && (node.type === 'group' || node.type === 'server-folder');
  const deleteGroup = (node) => {
    if (!canDelete(node)) return;
    if (isBranch(node)) {
      const path = node.type === 'server-folder' ? node.path : node.groupName;
      onGroupDelete?.({ type: 'group-branch', path, names: branchNames(path) });
      return;
    }
    onGroupDelete?.(getGroupsExplorerEditTarget(node));
  };
  // The selected row wins over the open folder, so "Add group" lands inside what the user picked.
  const targetContainer = canContain(selectedNode) ? containerOf(selectedNode) : currentContainer;

  const askSubgroup = (parent = targetContainer) => setSubgroupDraft({ parent, name: 'New subgroup' });
  const submitSubgroup = (event) => {
    event.preventDefault();
    const name = subgroupDraft.name.trim();
    if (!name) return;
    setSubgroupDraft(null);
    onGroupCreate?.({ name: [subgroupDraft.parent, name].filter(Boolean).join(SEPARATOR), parentGroup: subgroupDraft.parent || null });
  };

  const segments = isAccountFolder ? location.groupName.split(SEPARATOR) : folderPath ? folderPath.split(SEPARATOR) : [];
  const crumbs = segments.map((part, index) => (
    isAccountFolder && index === segments.length - 1
      ? { type: 'group', id: `group:${location.groupName}`, label: part, groupName: location.groupName, group: location.group }
      : folderNode(segments.slice(0, index + 1).join(SEPARATOR))
  ));
  const parentNode = isAccountFolder
    ? folderNode(folderPath)
    : location.type === 'server-folder' ? folderNode(getServerGroupParentPath(folderPath)) : GROUPS_ROOT_NODE;

  const menu = (node) => (
    <ContextMenu.Portal>
      <ContextMenu.Content className="dummy-group-menu">
        {node.type === 'group-account' ? (
          <>
            <ContextMenu.Item onSelect={() => openAccountGroup(node)}>Group settings</ContextMenu.Item>
            <ContextMenu.Item onSelect={() => onAccountOpen?.(node)}>Open account</ContextMenu.Item>
          </>
        ) : (
          <ContextMenu.Item onSelect={() => activate(node)}>
            {node.type === 'group' ? (allGroups || !rowIsBranch(node) ? 'Settings' : 'Open') : 'Open folder'}
          </ContextMenu.Item>
        )}
        {node.type === 'group' && rowIsBranch(node) && !allGroups && <ContextMenu.Item onSelect={() => openSettings(node)}>Settings</ContextMenu.Item>}
        {node.type === 'group' && !allGroups && <ContextMenu.Item onSelect={() => navigate(node)}>Open accounts</ContextMenu.Item>}
        {canLifecycle && node.type !== 'group-account' && <ContextMenu.Item hidden={!canLifecycle} disabled={!canLoadGroups || !canLifecycle} onSelect={() => addGroup(containerOf(node))}>Add group</ContextMenu.Item>}
        {node.type !== 'group-account' && <ContextMenu.Item hidden={!canLifecycle} disabled={!canLoadGroups || !canLifecycle} onSelect={() => askSubgroup(containerOf(node))}>Add subgroup</ContextMenu.Item>}
        {canDelete(node) && (
          <>
            <ContextMenu.Separator />
            <ContextMenu.Item disabled={deleting} onSelect={() => deleteGroup(node)}>{isBranch(node) ? 'Delete with subgroups' : 'Delete group'}</ContextMenu.Item>
          </>
        )}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );

  return (
    <section className="dummy-groups-explorer server-groups-explorer" aria-label="Groups explorer">
      <div className="dummy-group-header-bar">
        {/* Left: Navigation path & breadcrumbs */}
        <div className="dummy-group-path">
          <button
            type="button"
            className="dummy-group-nav-btn"
            title="Up one folder"
            aria-label="Up one folder"
            disabled={isRoot || allGroups}
            onClick={() => navigate(parentNode)}
          >
            <ArrowUp size={13} strokeWidth={2.2} />
          </button>
          <nav aria-label="Group folder path" className="dummy-group-breadcrumbs">
            <button
              type="button"
              className={`dummy-crumb-item${isRoot && !allGroups ? ' is-current' : ''}`}
              onClick={() => navigate(GROUPS_ROOT_NODE)}
            >
              <YellowFolderIcon />
              <span>Groups</span>
            </button>
            {crumbs.map(crumb => (
              <span key={crumb.id} className="dummy-crumb-segment">
                <ChevronRight size={11} className="dummy-crumb-sep" />
                <button
                  type="button"
                  className={`dummy-crumb-item${crumb.id === location.id ? ' is-current' : ''}`}
                  aria-current={crumb.id === location.id ? 'page' : undefined}
                  onClick={() => navigate(crumb)}
                >
                  <span>{crumb.label}</span>
                </button>
              </span>
            ))}
          </nav>
        </div>

        {/* Right: Group Action Buttons */}
        <div className="dummy-group-tools" role="toolbar" aria-label="Group actions">
          <button
            type="button"
            className="dummy-btn-action dummy-btn-primary"
            hidden={!canLifecycle} disabled={!canLoadGroups || !canLifecycle}
            onClick={() => addGroup(targetContainer)}
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>Add group</span>
          </button>
          <button
            type="button"
            className="dummy-btn-action dummy-btn-secondary"
            hidden={!canLifecycle} disabled={!canLoadGroups || !canLifecycle}
            onClick={() => askSubgroup()}
          >
            <YellowFolderIcon />
            <span>Add subgroup</span>
          </button>
          <button
            type="button"
            className="dummy-btn-action dummy-btn-secondary"
            disabled={selectedNode?.type !== 'group'}
            onClick={() => openSettings(selectedNode)}
          >
            <Pencil size={12} strokeWidth={2} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="dummy-btn-action dummy-btn-danger"
            disabled={!canDelete(selectedNode) || deleting}
            hidden={!canLifecycle} onClick={() => deleteGroup(selectedNode)}
          >
            <Trash2 size={12} strokeWidth={2} />
            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>

      <div className="server-group-list-bar">
        <div className="server-group-list-heading">
          <span className="server-group-list-type">{listType}</span>
          <h2 title={listTitle}>{listTitle}</h2>
          <span className="server-group-list-count" role="status">{countLabel}</span>
        </div>
        <div className="server-group-list-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label={`Search ${noun} in this view`}
            placeholder={`Search ${noun}...`}
            value={localSearch}
            onChange={event => setLocalSearch(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') setLocalSearch(''); }}
          />
          {localSearch && <button type="button" aria-label="Clear search" onClick={() => setLocalSearch('')}><X size={13} /></button>}
        </div>
      </div>

      <div className="dummy-group-table-wrap" aria-busy={loading} role="region" aria-label={`${noun} table`} tabIndex={0}>
        <table className="server-group-data-table" data-layout={isAccountFolder && !allGroups ? 'accounts' : allGroups || isRoot ? 'groups' : 'mixed'} aria-label={allGroups ? 'All groups' : isAccountFolder ? `Accounts in ${location.groupName}` : isRoot ? 'Groups' : `Groups in ${serverPath}`}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} scope="col" data-column={column.key} style={column.numeric ? { textAlign: 'right' } : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {/* One context menu for the whole table; the right-clicked row is remembered in menuNode. */}
          <ContextMenu.Root onOpenChange={open => { if (!open) setMenuNode(null); }}>
          <ContextMenu.Trigger asChild>
          <tbody onContextMenu={event => {
            const id = event.target.closest?.('tr[data-node-id]')?.dataset.nodeId;
            const node = id ? visibleNodes.find(item => item.id === id) : null;
            if (!node) { event.preventDefault(); return; }
            select(node);
            setMenuNode(node);
          }}>
            {visibleNodes.map((node, index) => {
              const Icon = node.type === 'group' && rowIsBranch(node) ? YellowFolderIcon : nodeIcon(node);
              const selected = effectiveSelectedId === node.id;
              const row = rows[index];
              const childCount = isBranch(node) ? node.count : null;
              return (
                    <tr
                      key={node.id}
                      tabIndex={0}
                      aria-selected={selected}
                      data-node-id={node.id}
                      onClick={() => select(node)}
                      onFocus={() => select(node)}
                      onDoubleClick={() => activate(node)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') { event.preventDefault(); activate(node); }
                        if (event.key === ' ') { event.preventDefault(); select(node); }
                      }}
                    >
                      {columns.map((column, cell) => {
                        // The first cell names the row: a group's name or an account's login.
                        const val = cellText(cell === 0 ? node.label : row[column.key]);
                        return (
                          <td key={column.key} data-column={column.key} title={val || undefined} style={column.numeric ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : undefined}>
                            {cell === 0 ? (
                              <span className="dummy-group-name">
                                <Icon size={15} />
                                <span className={`dummy-group-label-text${node.type === 'group-account' ? ' server-group-login' : ''}`}>{val}</span>
                                {childCount !== null && (
                                  <span className="dummy-group-badge">
                                    {childCount} {childCount === 1 ? 'group' : 'groups'}
                                  </span>
                                )}
                              </span>
                            ) : val !== '' ? (
                              column.key === 'status' ? (
                                <span className="server-group-status" data-state={val.toLowerCase()}><span aria-hidden="true" />{val}</span>
                              ) : column.key === 'balance' || column.key === 'equity' ? (
                                <span className="server-group-number">{formatAmount(val)}</span>
                              ) : column.key === 'name' ? (
                                <span className="server-group-account-name">{val}</span>
                              ) : column.key === 'group' ? (
                                <span className="server-group-path-value">{val}</span>
                              ) : val
                            ) : (
                              <span className="dummy-cell-empty">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
              );
            })}
          </tbody>
          </ContextMenu.Trigger>
          {menuNode && menu(menuNode)}
          </ContextMenu.Root>
        </table>
        {!canRead ? (
          <p role="alert" className="dummy-group-empty">
            {canLoadGroups ? 'Account access required to open this folder.' : 'Group access required.'}
          </p>
        ) : loading ? (
          <p role="status" className="dummy-group-empty">Loading {noun}...</p>
        ) : error ? (
          <div role="alert" className="dummy-group-empty">
            Unable to load {noun}. <button type="button" onClick={() => { retryGroups(); retryAccounts(); }}>Retry</button>
          </div>
        ) : !visibleNodes.length ? (
          <p role="status" className="dummy-group-empty">
            {searchQuery.trim() || localSearch.trim() ? `No ${noun} match your search.` : isAccountFolder && !allGroups ? 'No accounts in this group.' : isRoot ? 'No groups yet. Use Add group to create a main group.' : `No ${folderGroupName ? 'subgroups or accounts' : 'subgroups'} in ${serverPath.split(SEPARATOR).at(-1)} yet. Use Add group or Add subgroup to create one.`}
          </p>
        ) : null}
      </div>

      <div className="dummy-group-footer">
        <div role="tablist" aria-label="Group list views" className="dummy-group-tabs">
          <button type="button" role="tab" aria-selected={!allGroups} onClick={() => setAllGroups(false)}>
            <span>{isAccountFolder ? 'Accounts' : isRoot ? 'Groups' : 'This folder'}</span>
            <span className="dummy-tab-count">({folderCount})</span>
          </button>
          <button type="button" role="tab" aria-selected={allGroups} onClick={() => { setAllGroups(true); setSelection(null); }}>
            <span>All Groups</span>
            <span className="dummy-tab-count">({groupCount})</span>
          </button>
        </div>
        <div className="dummy-group-status-tip" role="status">
          <Info size={12} className="dummy-tip-icon" />
          <span><span className="server-group-scroll-tip">Scroll horizontally for more columns. </span>{isAccountFolder && !allGroups ? "Double-click an account for its group's settings; right-click to open the account." : folderGroupName && accountNodes.length ? "Double-click a folder to open it, or an account for its group's settings." : 'Double-click a folder or main group to open it; double-click a client group for its properties.'}</span>
        </div>
      </div>

      <Dialog.Root open={Boolean(subgroupDraft)} onOpenChange={open => { if (!open) setSubgroupDraft(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dummy-group-overlay" />
          <Dialog.Content className="dummy-group-action-dialog">
            <Dialog.Title>Add subgroup</Dialog.Title>
            <Dialog.Description>Choose the group that will contain the new subgroup, then name it. Its full name joins both with a backslash.</Dialog.Description>
            <form onSubmit={submitSubgroup}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label>Inside group
                  <select value={subgroupDraft?.parent ?? ''} onChange={event => setSubgroupDraft(draft => ({ ...draft, parent: event.target.value }))} style={SELECT_STYLE}>
                    <option value="">Groups (top level)</option>
                    {groupNodes.map(node => node.groupName).map(container => <option key={container} value={container}>{container}</option>)}
                  </select>
                </label>
                <label>Subgroup name
                  <input autoFocus value={subgroupDraft?.name ?? ''} onChange={event => setSubgroupDraft(draft => ({ ...draft, name: event.target.value }))} />
                </label>
              </div>
              <div className="dummy-group-action-footer">
                <button type="button" onClick={() => setSubgroupDraft(null)}>Cancel</button>
                <button type="submit" disabled={!subgroupDraft?.name.trim()}>Continue</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
};

// One mounted explorer serves every folder; the cached group list and per-folder
// view state make navigation a plain re-render instead of a remount.
const GroupsExplorer = ({ location = ROOT_LOCATION, ...props }) => (
  <ServerGroupsExplorer location={location} {...props} />
);

export default GroupsExplorer;
