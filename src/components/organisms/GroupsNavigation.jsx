import { useCallback, useState } from 'react';
import { Folder, FileText } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import DummyGroupsNavigation from './DummyGroupsNavigation';
import { useDummyGroupsStore } from '../../store/useDummyGroupsStore';
import { useDataFetch } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { ManagerService } from '../../services/manager.service';
import { AccountsService } from '../../services/accounts.service';
import { canAccessView } from '../../utils/permissions';
import { loadGroupTreePages, normalizeNavigationGroups, normalizeNavigationAccounts } from '../../utils/groupTreeData';

const loadGroups = async () => normalizeNavigationGroups(await loadGroupTreePages(
  ManagerService.getGroupList,
  { arrayKeys: ['answer', 'groups', 'data', 'items', 'rows'] },
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
        <button type="button" className="underline text-[color:var(--accent-600)]" onClick={onRetry}>Retry</button>
      </div>
    ) : empty ? `No ${noun}` : null}
  </div>
);

const GroupFolder = ({ group, level, canLoadAccounts, refreshTrigger, ...treeProps }) => {
  const reveal = treeProps.groupExplorerReveal;
  const revealRevision = reveal?.type === 'group' && (reveal.id === group.id || reveal.groupName === group.groupName) ? reveal.revision : null;
  const [expanded, setExpanded] = useGroupExpansion(revealRevision);
  const loadAccounts = useCallback(async (params) => normalizeNavigationAccounts(
    await loadGroupTreePages(AccountsService.getAccounts, {
      ...params,
      arrayKeys: ['accounts', 'data', 'answer', 'items', 'rows'],
    }),
    group.groupName,
  ), [group.groupName]);
  const { data: accounts, loading, error, mutate } = useDataFetch(
    loadAccounts,
    { group: group.groupName },
    [group.groupName, refreshTrigger],
    expanded && canLoadAccounts,
  );

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
        count: canLoadAccounts && !loading && !error ? accounts?.length : undefined,
        countInParentheses: true,
        initiallyExpanded: false,
        renderChildren: ({ level: childLevel }) => canLoadAccounts ? (
          <>
            {(loading || error || !accounts?.length) && (
              <BranchStatus level={childLevel} loading={loading} error={error} empty={!accounts?.length} noun="accounts" onRetry={mutate} />
            )}
            {!loading && !error && accounts?.map(account => (
              <TreeItem
                {...treeProps}
                key={account.id}
                level={childLevel}
                item={{ ...account, type: 'group-account', icon: FileText }}
              />
            ))}
          </>
        ) : (
          <div style={{ paddingLeft: `${childLevel * 14 + 26}px` }} className="py-1 text-[11px] text-[color:var(--text-muted)]">
            Account access required
          </div>
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
  const { data: groups, loading, error, mutate } = useDataFetch(
    loadGroups, null, [refreshTrigger], expanded && canLoadGroups,
  );
  const groupCount = canLoadGroups && !loading && !error ? groups?.length : undefined;

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
        renderChildren: ({ level: adminLevel }) => (
          <TreeItem
            {...treeProps}
            level={adminLevel}
            item={{
              id: 'groups:admin',
              type: 'groups-admin',
              label: 'Admin',
              icon: Folder,
              initiallyExpanded: false,
              count: groupCount,
              countInParentheses: true,
              renderChildren: ({ level: groupLevel }) => canLoadGroups ? (
                <>
                  {(loading || error || !groups?.length) && (
                    <BranchStatus level={groupLevel} loading={loading} error={error} empty={!groups?.length} noun="groups" onRetry={mutate} />
                  )}
                  {!error && groups?.map(group => (
                    <GroupFolder
                      {...treeProps}
                      key={group.id}
                      group={group}
                      level={groupLevel}
                      canLoadAccounts={canLoadAccounts}
                      refreshTrigger={refreshTrigger}
                    />
                  ))}
                </>
              ) : (
                <div style={{ paddingLeft: `${groupLevel * 14 + 26}px` }} className="py-1 text-[11px] text-[color:var(--text-muted)]">
                  Group access required
                </div>
              ),
            }}
          />
        ),
      }}
    />
  );
};

const GroupsNavigation = (props) => {
  const mode = useDummyGroupsStore(state => state.mode);
  return mode === 'dummy' ? <DummyGroupsNavigation {...props} /> : <ServerGroupsNavigation {...props} />;
};

export default GroupsNavigation;
