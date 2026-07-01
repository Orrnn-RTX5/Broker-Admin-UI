import { useMemo } from 'react';
import { User } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { sidebarData } from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';
import { useAuthStore } from '../../store/authStore';
import { canAccessView } from '../../utils/permissions';
import { normalizePagedResponse } from '../../utils/apiShapes';
import { shouldBlockViewNavigation } from '../../config/viewCapabilities';

const LOCKED_DROPDOWN_LABELS = new Set(['Automations', 'Security', 'Platform Config', 'Network Cluster', 'Risk Management', 'Communications', 'Support Center']);
const SIDEBAR_GROUP_LIMIT = 100;

const SidebarNavTree = ({ onNodeSelect, onNodeDoubleClick, onLockedDropdownClick, selectedNodeLabel }) => {
  const currentUser = useAuthStore((state) => state.user);
  const canLoadGroups = canAccessView(currentUser, 'Groups');
  const { data: groupsResponse } = useGroups(1, SIDEBAR_GROUP_LIMIT, '', canLoadGroups);

  const dynamicSidebarData = useMemo(() => {
    const cloneTree = (nodes) =>
      nodes.map((node) => {
        const newNode = { ...node };
        newNode.blockedNavigation = shouldBlockViewNavigation(newNode.label);

        if (LOCKED_DROPDOWN_LABELS.has(newNode.label)) {
          newNode.lockedDropdown = true;
          newNode.initiallyExpanded = false;
        } else if (newNode.label === 'Groups') {
          const groupPage = canLoadGroups && groupsResponse
            ? normalizePagedResponse(groupsResponse, {
                arrayKeys: ['answer', 'groups', 'data', 'items', 'rows'],
                page: 1,
                limit: SIDEBAR_GROUP_LIMIT,
              })
            : { rows: [], total: undefined, hasKnownTotal: false };
          const apiGroups = groupPage.rows.slice(0, SIDEBAR_GROUP_LIMIT);
          newNode.initiallyExpanded = false;
          newNode.count = canLoadGroups && groupsResponse
            ? (groupPage.hasKnownTotal ? groupPage.total : apiGroups.length)
            : undefined;
          newNode.children = apiGroups.map((g) => ({
            label: g.name,
            count: undefined,
            icon: User,
          }));
        } else if (newNode.label === 'Clients & Accounts') {
          if (newNode.children) {
            newNode.children = cloneTree(newNode.children);
          }
        } else if (newNode.children) {
          newNode.children = cloneTree(newNode.children);
        }

        return newNode;
      });

    return cloneTree(sidebarData);
  }, [canLoadGroups, groupsResponse]);

  return (
    <div className="w-[280px] h-full bg-[color:var(--bg-surface-1)] flex flex-col border-r border-[color:var(--border-default)] overflow-y-auto no-scrollbar py-2 shadow-[var(--shadow-sm)]">
      {dynamicSidebarData.map((item, index) => (
        <TreeItem
          key={`${item.label}-${index}`}
          item={item}
          onSelect={onNodeSelect}
          onDoubleClick={onNodeDoubleClick}
          onLockedDropdownClick={onLockedDropdownClick}
          selectedLabel={selectedNodeLabel}
        />
      ))}
    </div>
  );
};

export default SidebarNavTree;
