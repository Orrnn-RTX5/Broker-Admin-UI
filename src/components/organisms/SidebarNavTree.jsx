import { useMemo } from 'react';
import { User } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { sidebarData } from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';

const SidebarNavTree = ({ onNodeSelect, onNodeDoubleClick, selectedNodeLabel }) => {
  const { data: groupsResponse } = useGroups(true);

  const dynamicSidebarData = useMemo(() => {
    const cloneTree = (nodes) =>
      nodes.map((node) => {
        const newNode = { ...node };

        if (newNode.label === 'Groups') {
          const apiGroups = groupsResponse
            ? (Array.isArray(groupsResponse) ? groupsResponse : groupsResponse.answer || [])
            : [];
          newNode.count = groupsResponse ? apiGroups.length : undefined;
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
  }, [groupsResponse]);

  return (
    <div className="w-[260px] h-full bg-[color:var(--bg-surface-1)] flex flex-col border-r border-[color:var(--border-subtle)] overflow-y-auto no-scrollbar py-1">
      {dynamicSidebarData.map((item, index) => (
        <TreeItem
          key={`${item.label}-${index}`}
          item={item}
          onSelect={onNodeSelect}
          onDoubleClick={onNodeDoubleClick}
          selectedLabel={selectedNodeLabel}
        />
      ))}
    </div>
  );
};

export default SidebarNavTree;
