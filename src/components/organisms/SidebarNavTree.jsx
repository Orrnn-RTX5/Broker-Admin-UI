import React from 'react';
import TreeItem from '../molecules/TreeItem';
import { sidebarData } from '../../data/terminalData.jsx';

const SidebarNavTree = ({ onNodeSelect, selectedNodeLabel }) => {
  return (
    <div className="w-[280px] h-full bg-[#1e1e1e] flex flex-col border-r border-black/40 overflow-y-auto no-scrollbar py-1 shadow-inner">
      {sidebarData.map((item, index) => (
        <TreeItem 
          key={`${item.label}-${index}`} 
          item={item} 
          onSelect={onNodeSelect}
          selectedLabel={selectedNodeLabel}
        />
      ))}
    </div>
  );
};

export default SidebarNavTree;
