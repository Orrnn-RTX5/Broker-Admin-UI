import { useCallback, useMemo, useState } from 'react';
import { Folder, User } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { useDataFetch } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { ManagerService } from '../../services/manager.service';
import { AccountsService } from '../../services/accounts.service';
import { canAccessView } from '../../utils/permissions';
import { loadGroupTreePages, normalizeNavigationAccounts } from '../../utils/groupTreeData';
import { getServerGroupFolderNodes } from '../../utils/groupsExplorerData';
import { GROUP_LIST_ARRAY_KEYS, GROUP_LIST_FETCH_OPTIONS, loadGroupList, readGroupListSnapshot } from '../../utils/groupListCache';

// Same cached request as the explorer, so opening the tree never repeats the fetch.
const loadGroups = () => loadGroupList(() => loadGroupTreePages(
  ManagerService.getGroupList,
  { arrayKeys: GROUP_LIST_ARRAY_KEYS },
));

const useGroupExpansion = (revealRevision) => {
  const [expansion, setExpansion] = useState({ open: false, revealedAt: null });
  const shouldReveal = revealRevision !== null && revealRevision !== expansion.revealedAt;
  if (shouldReveal) setExpansion({ open: true, revealedAt: revealRevision });
  const setExpanded = useCallback(open => setExpansion(previous => ({ ...previous, open })), []);
  return [shouldReveal || expansion.open, setExpanded];
};

const BranchStatus = ({ level, loading, error, empty, noun, onRetry }) => (
  <div style={{ paddingLeft: `${level * 14 + 26}px` }} className="pr-2 py-1 text-[11px] text-[color:var(--text-muted)]">
    {loading ? <span role="status">Loading {noun}…</span> : error ? (
      <div role="alert">
        Unable to load {noun}.{' '}
        <button type="button" className="underline text-white" onClick={onRetry}>Retry</button>
      </div>
    ) : empty ? `No ${noun}` : null}
  </div>
);

// One group's accounts, picked from the account list loaded once for the whole tree.
const useGroupAccounts = (accounts, groupName) => useMemo(
  () => (accounts.rows && groupName ? normalizeNavigationAccounts(accounts.rows, groupName) : null),
  [accounts.rows, groupName],
);

const GroupAccountItems = ({ accounts, groupAccounts, level, showEmpty, ...treeProps }) => {
  if (!accounts.canLoad) {
    return showEmpty ? (
      <div style={{ paddingLeft: `${level * 14 + 26}px` }} className="py-1 text-[11px] text-[color:var(--text-muted)]">
        Account access required
      </div>
    ) : null;
  }
  const empty = !groupAccounts?.length;
  return (
    <>
      {(accounts.loading || accounts.error || (empty && showEmpty)) && (
        <BranchStatus level={level} loading={accounts.loading} error={accounts.error} empty={empty} noun="accounts" onRetry={accounts.retry} />
      )}
      {groupAccounts?.map(account => (
        <TreeItem
          {...treeProps}
          key={account.id}
          level={level}
          item={{ ...account, type: 'group-account', icon: User }}
        />
      ))}
    </>
  );
};

const GroupFolder = ({ group, level, accounts, ...treeProps }) => {
  const reveal = treeProps.groupExplorerReveal;
  const revealRevision = reveal?.type === 'group' && (reveal.id === group.id || reveal.groupName === group.groupName) ? reveal.revision : null;
  const [expanded, setExpanded] = useGroupExpansion(revealRevision);
  const groupAccounts = useGroupAccounts(accounts, group.groupName);

  return (
    <TreeItem
      {...treeProps}
      level={level}
      expanded={expanded}
      onExpandedChange={setExpanded}
      item={{
        ...group,
        type: 'group',
        icon: Folder,
        count: groupAccounts?.length,
        countInParentheses: true,
        initiallyExpanded: false,
        renderChildren: ({ level: childLevel }) => (
          <GroupAccountItems {...treeProps} accounts={accounts} groupAccounts={groupAccounts} level={childLevel} showEmpty />
        ),
      }}
    />
  );
};

const groupLeafLabel = (groupName) => groupName.split('\\').at(-1);

// A group that owns subgroups is shown as the folder of its own name.
const asFolder = (node) => (node.type === 'server-folder'
  ? node
  : { ...node, id: `server-folder:${node.groupName}`, type: 'server-folder', path: node.groupName, label: groupLeafLabel(node.groupName) });

// Rows directly under Groups are main groups, so they are always folders.
const ServerFolderChildren = ({ groups, path, level, ...folderProps }) => {
  const nodes = useMemo(() => getServerGroupFolderNodes(groups, path), [groups, path]);
  return nodes.map(node => (node.type === 'server-folder' || node.count > 0 || !path
    ? <ServerFolder key={node.id} node={asFolder(node)} groups={groups} level={level} {...folderProps} />
    : <GroupFolder key={node.id} group={{ ...node, label: groupLeafLabel(node.groupName) }} level={level} {...folderProps} />
  ));
};

// A folder that is itself a server group (every main group) lists its own
// accounts after its subgroups.
const ServerFolder = ({ node, groups, level, accounts, ...treeProps }) => {
  const groupAccounts = useGroupAccounts(accounts, node.groupName);
  return (
    <TreeItem
      {...treeProps}
      level={level}
      item={{
        ...node,
        icon: Folder,
        count: node.count + (groupAccounts?.length ?? 0),
        countInParentheses: true,
        initiallyExpanded: false,
        renderChildren: ({ level: childLevel }) => (
          <>
            <ServerFolderChildren
              {...treeProps}
              groups={groups}
              path={node.path}
              level={childLevel}
              accounts={accounts}
            />
            {node.groupName && (
              <GroupAccountItems {...treeProps} accounts={accounts} groupAccounts={groupAccounts} level={childLevel} showEmpty={!node.count} />
            )}
          </>
        ),
      }}
    />
  );
};

const ServerGroupsNavigation = ({ item, level = 0, refreshTrigger, ...treeProps }) => {
  const [expanded, setExpanded] = useGroupExpansion(treeProps.groupExplorerReveal?.revision ?? null);
  const currentUser = useAuthStore(state => state.user);
  const canLoadGroups = canAccessView(currentUser, 'Groups');
  const canLoadAccounts = canLoadGroups && canAccessView(currentUser, 'Trading Accounts');
  const { data: liveGroups, loading: fetching, error, mutate } = useDataFetch(
    loadGroups, null, [refreshTrigger], expanded && canLoadGroups, GROUP_LIST_FETCH_OPTIONS,
  );
  const snapshot = useMemo(() => (liveGroups ? null : readGroupListSnapshot()), [liveGroups]);
  const groups = liveGroups ?? snapshot;
  const loading = fetching && !groups;
  const groupCount = canLoadGroups && !loading && !error ? groups?.length : undefined;
  // One account list for the whole tree; every folder picks its own group's accounts from it.
  const { data: accountRows, loading: accountsLoading, error: accountsError, mutate: retryAccounts } = useDataFetch(
    AccountsService.getAllAccounts, null, [refreshTrigger], expanded && canLoadAccounts,
  );
  const accounts = useMemo(() => ({
    canLoad: canLoadAccounts,
    rows: accountsLoading ? null : accountRows,
    loading: canLoadAccounts && accountsLoading,
    error: canLoadAccounts && !accountsLoading ? accountsError : null,
    retry: () => {
      AccountsService.invalidateCache();
      return retryAccounts();
    },
  }), [accountRows, accountsError, accountsLoading, canLoadAccounts, retryAccounts]);

  return (
    <TreeItem
      {...treeProps}
      level={level}
      expanded={expanded}
      onExpandedChange={setExpanded}
      item={{
        ...item,
        id: 'groups',
        type: 'groups-root',
        count: groupCount,
        countInParentheses: true,
        children: undefined,
        initiallyExpanded: false,
        // Main groups hang directly off Groups; there is no intermediate Admin folder.
        renderChildren: ({ level: groupLevel }) => canLoadGroups ? (
          <>
            {(loading || error || !groups?.length) && (
              <BranchStatus level={groupLevel} loading={loading} error={error} empty={!groups?.length} noun="groups" onRetry={mutate} />
            )}
            {!error && groups?.length > 0 && (
              <ServerFolderChildren
                {...treeProps}
                groups={groups}
                path=""
                level={groupLevel}
                accounts={accounts}
              />
            )}
          </>
        ) : (
          <div style={{ paddingLeft: `${groupLevel * 14 + 26}px` }} className="py-1 text-[11px] text-[color:var(--text-muted)]">
            Group access required
          </div>
        ),
      }}
    />
  );
};

export default ServerGroupsNavigation;
