import { useMemo } from 'react';
import TreeItem from '../molecules/TreeItem';
import GroupsNavigation from './GroupsNavigation';
import { sidebarData } from '../../data/terminalData.jsx';
import { shouldBlockViewNavigation } from '../../config/viewCapabilities';

const LOCKED_DROPDOWN_LABELS = new Set(['Automations', 'Security', 'Platform Config', 'Network Cluster', 'Risk Management', 'Communications', 'Support Center']);

const SidebarNavTree = ({ onNodeSelect, onNodeDoubleClick, onLockedDropdownClick, selectedNodeLabel, selectedNodeId, refreshTrigger, groupExplorerReveal }) => {

  const dynamicSidebarData = useMemo(() => {
    const cloneTree = (nodes) =>
      nodes.map((node) => {
        const newNode = { ...node };
        newNode.blockedNavigation = shouldBlockViewNavigation(newNode.label);

        if (LOCKED_DROPDOWN_LABELS.has(newNode.label)) {
          newNode.lockedDropdown = true;
          newNode.initiallyExpanded = false;
        } else if (newNode.label === 'Groups') {
          newNode.id = 'groups';
          newNode.type = 'groups-root';
          newNode.component = GroupsNavigation;
          newNode.initiallyExpanded = false;
          newNode.children = [];
        } else if (newNode.label === 'Clients & Accounts') {
          if (newNode.children) {
            newNode.children = cloneTree(newNode.children);
          }
        } else if (newNode.children) {
          newNode.children = cloneTree(newNode.children);
        }

        newNode.containsGroups = newNode.type === 'groups-root' || Boolean(newNode.children?.some(child => child.containsGroups));

        return newNode;
      });

    return cloneTree(sidebarData);
  }, []);

  return (
    <div className="w-[280px] h-full bg-[color:var(--bg-surface-1)] flex flex-col border-r border-[color:var(--border-default)] overflow-y-auto no-scrollbar py-2 shadow-[var(--shadow-sm)]">
      {dynamicSidebarData.map((item, index) => {
        const Item = item.component || TreeItem;
        return <Item
          key={`${item.label}-${index}`}
          item={item}
          onSelect={onNodeSelect}
          onDoubleClick={onNodeDoubleClick}
          onLockedDropdownClick={onLockedDropdownClick}
          selectedLabel={selectedNodeLabel}
          selectedId={selectedNodeId}
          refreshTrigger={refreshTrigger}
          groupExplorerReveal={groupExplorerReveal}
        />;
      })}
    </div>
  );
};

export default SidebarNavTree;
