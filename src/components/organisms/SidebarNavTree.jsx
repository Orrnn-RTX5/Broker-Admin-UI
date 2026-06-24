import { useMemo } from 'react';
import { User } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { sidebarData } from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';
import { useAuthStore } from '../../store/authStore';
import { canAccessView } from '../../utils/permissions';
import { shouldBlockViewNavigation } from '../../config/viewCapabilities';

const LOCKED_DROPDOWN_LABELS = new Set(['Automations', 'Security']);

const SidebarNavTree = ({ onNodeSelect, onNodeDoubleClick, onLockedDropdownClick, selectedNodeLabel }) => {
  const currentUser = useAuthStore((state) => state.user);
  const canLoadGroups = canAccessView(currentUser, 'Groups');
  const { data: groupsResponse } = useGroups(canLoadGroups);

  const dynamicSidebarData = useMemo(() => {
    const cloneTree = (nodes) =>
      nodes.map((node) => {
        const newNode = { ...node };
        newNode.blockedNavigation = shouldBlockViewNavigation(newNode.label);

        if (LOCKED_DROPDOWN_LABELS.has(newNode.label)) {
          newNode.lockedDropdown = true;
          newNode.initiallyExpanded = false;
        } else if (newNode.label === 'Groups') {
          const apiGroups = canLoadGroups && groupsResponse
            ? (Array.isArray(groupsResponse) ? groupsResponse : groupsResponse.answer || [])
            : [];
          newNode.count = canLoadGroups && groupsResponse ? apiGroups.length : undefined;
          newNode.children = apiGroups.map((g) => ({
            label: g.name,
            count: undefined,
            icon: User,
          }));
        } else if (newNode.children) {
          newNode.children = cloneTree(newNode.children);
        }

        return newNode;
      });

    return cloneTree(sidebarData);
  }, [canLoadGroups, groupsResponse]);

  return (
    <div className="w-[260px] h-full bg-[color:var(--bg-surface-1)] flex flex-col border-r border-[color:var(--border-subtle)] overflow-y-auto no-scrollbar py-1">
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
