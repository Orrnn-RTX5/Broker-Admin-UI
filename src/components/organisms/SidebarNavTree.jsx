import React, { useMemo } from 'react';
import TreeItem from '../molecules/TreeItem';
import { sidebarData } from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';

const BlueUserIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SidebarNavTree = ({ onNodeSelect, onNodeDoubleClick, selectedNodeLabel }) => {
  const { data: groupsResponse } = useGroups(true);

  const dynamicSidebarData = useMemo(() => {
    const cloneTree = (nodes) => {
      return nodes.map(node => {
        const newNode = { ...node };
        
        if (newNode.label === 'Groups') {
          if (groupsResponse) {
            const apiGroups = Array.isArray(groupsResponse) ? groupsResponse : (groupsResponse.answer || []);
            newNode.count = apiGroups.length;
            newNode.children = apiGroups.map(g => ({
              label: g.name,
              count: undefined,
              icon: BlueUserIcon
            }));
          }
        } else if (newNode.children) {
          newNode.children = cloneTree(newNode.children);
        }
        
        return newNode;
      });
    };
    
    return cloneTree(sidebarData);
  }, [groupsResponse]);

  return (
    <div className="w-[280px] h-full bg-[#1e1e1e] flex flex-col border-r border-black/40 overflow-y-auto no-scrollbar py-1 shadow-inner">
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
