import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, File, Server, Cpu } from 'lucide-react';

const TreeItem = ({ item, level = 0, isLast = false, onSelect, onDoubleClick, selectedLabel }) => {
  const [isOpen, setIsOpen] = useState(item.initiallyExpanded);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = selectedLabel === item.label;

  // Use the icon from item, or default to Folder/File
  const Icon = item.icon || (hasChildren ? Folder : File);

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const handleNodeClick = () => {
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleNodeDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(item);
    }
  };

  return (
    <div className="relative">
      <div 
        onClick={handleNodeClick}
        onDoubleClick={handleNodeDoubleClick}
        className={`flex items-center gap-1 py-[2px] px-1 cursor-default group transition-none select-none relative
          ${isActive ? 'bg-[#3e3e42] text-white shadow-sm ring-1 ring-blue-500/30' : 'hover:bg-[#2b2b2b] text-[#cccccc]'}
        `}
        style={{ paddingLeft: `${level * 14 + 4}px` }}
      >
        {/* Expand/Collapse Arrow */}
        <div 
          onClick={handleArrowClick}
          className="w-4 h-4 flex items-center justify-center shrink-0 hover:bg-white/10 rounded-sm"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={11} className="text-[#808080]" /> : <ChevronRight size={11} className="text-[#808080]" />
          ) : null}
        </div>
        
        {/* Icon */}
        <div className={`w-4 h-4 flex items-center justify-center shrink-0`}>
          <Icon size={13} className={`${!item.icon ? 'text-[#d1d1d1]' : ''}`} />
        </div>
        
        {/* Label */}
        <span className={`text-[11px] whitespace-nowrap overflow-hidden text-ellipsis leading-tight flex-1 ml-0.5 ${isActive ? 'font-medium' : ''}`}>
          {item.label}
          {item.count !== undefined && <span className="ml-1 text-[10px] text-[#808080]">({item.count})</span>}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="mt-0">
          {item.children.map((child, index) => (
            <TreeItem 
              key={`${child.label}-${index}`} 
              item={child} 
              level={level + 1} 
              isLast={index === item.children.length - 1} 
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              selectedLabel={selectedLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
