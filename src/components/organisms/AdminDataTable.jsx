import React, { useState } from 'react';
import { terminalTableData, clientsAccountsTableData } from '../../data/terminalData.jsx';
import { Clock, CornerUpRight, Server, Calendar } from 'lucide-react';
import AdminContextMenu from './AdminContextMenu';

// Custom icons for MT5 style table
const YellowFolderIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const BlueUserIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const AdminDataTable = ({ onRowDoubleClick, viewType, onAddClick }) => {
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });

  const handleContextMenu = (e) => {
    if (viewType === 'Groups') {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true
      });
    }
  };
  const groupColumns = [
    { label: 'Group', key: 'group', width: 'w-64' },
    { label: 'Server', key: 'server', width: 'w-48' },
    { label: 'Company', key: 'company', width: 'w-64' },
    { label: 'Type', key: 'type', width: 'w-32' },
    { label: 'Authentication', key: 'auth', width: 'w-40' },
    { label: 'Risk Management', key: 'risk', width: 'w-48' },
    { label: 'Margin', key: 'margin', width: 'w-32' },
    { label: 'Floating Leverage Profile', key: 'leverage', width: 'w-56' },
    { label: 'Currency', key: 'currency', width: 'w-24' },
  ];

  const clientsColumns = [
    { label: 'Name', key: 'name', width: 'w-64' },
    { label: 'Description', key: 'description', width: 'flex-1' },
  ];

  let columns;
  let data;
  let isClientsViewTemp = false;

  if (viewType === 'Groups') {
    columns = groupColumns;
    data = terminalTableData;
  } else if (viewType === 'Clients & Accounts') {
    columns = clientsColumns;
    data = clientsAccountsTableData;
    isClientsViewTemp = true;
  } else {
    // Check if the viewType matches a specific sub-group name inside the terminalTableData
    const matchingSubGroupData = terminalTableData.filter(item => item.group === viewType);
    
    if (matchingSubGroupData.length > 0) {
      columns = groupColumns;
      data = matchingSubGroupData;
    } else {
      // Empty state for all other strictly empty specific pages (Orders, Deals, Network Cluster, etc.)
      columns = [
        { label: 'Item Name', width: 'w-64' },
        { label: 'Status', width: 'w-32' },
        { label: 'Description', width: 'flex-1' },
      ];
      data = [];
    }
  }

  const isClientsView = isClientsViewTemp;

  // --- TIME VIEW SPECIFIC LOGIC ---
  if (viewType === 'Time') {
    const PropertyRow = ({ idx, icon: Icon, label, value }) => (
      <div className={`flex items-center text-[12px] border-b border-black/20 ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20 cursor-default`}>
        <div className="w-[320px] flex items-center gap-2 px-3 py-[3px] border-r border-black/20 shrink-0">
          <Icon size={13} className="text-[#3B82F6]" />
          <span className="text-[#e1e1e1]">{label}</span>
        </div>
        <div className="flex-1 px-3 py-[3px] text-[#e1e1e1]">
          {value}
        </div>
      </div>
    );

    const GroupHeader = ({ title }) => (
      <div className="flex border-b border-black/20 bg-[#1e1e1e] cursor-default">
        <div className="w-[320px] px-3 py-1 text-[11px] font-bold text-white border-r border-black/20 shrink-0">
          {title}
        </div>
        <div className="flex-1"></div>
      </div>
    );

    return (
      <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex border-b border-black/40 bg-[#333333] sticky top-0 z-10 shadow-sm">
          <div className="w-[320px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 hover:bg-[#444444] cursor-default shrink-0">Property</div>
          <div className="flex-1 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] hover:bg-[#444444] cursor-default">Value</div>
        </div>
        <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
           <GroupHeader title="Common settings" />
           <PropertyRow idx={0} icon={Clock} label="Time zone" value="GMT+01:00" />
           <PropertyRow idx={1} icon={CornerUpRight} label="Daylight Saving time correction" value="Yes" />
           <PropertyRow idx={2} icon={Server} label="Time synchronization with" value="time.cloudflare.com, pool.ntp.org" />
           
           <GroupHeader title="Day settings" />
           {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
              <PropertyRow key={day} idx={idx} icon={Calendar} label={day} value="00:00-24:00" />
           ))}

           {/* Placeholder fill */}
           {[...Array(25)].map((_, i) => (
            <div key={i} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
               <div className="w-[320px] h-6 border-r border-black/10"></div>
               <div className="flex-1 h-6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onContextMenu={handleContextMenu}>
      {/* Table Header */}
      <div className="flex border-b border-black/40 bg-[#333333] sticky top-0 z-10 shadow-sm">
        {columns.map((col, idx) => (
          <div 
            key={idx} 
            className={`${col.width} px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 hover:bg-[#444444] cursor-default flex items-center shrink-0`}
          >
            {col.label}
          </div>
        ))}
        {/* Fill remaining space if needed */}
        {viewType === 'Groups' && <div className="flex-1 border-b border-black/20 bg-[#333333]"></div>}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
        {data.map((row, idx) => (
          <div 
            key={row.id} 
            onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
            className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20`}
          >
            {isClientsView ? (
              <>
                <div className="w-64 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  {row.iconType === 'group' ? <YellowFolderIcon /> : <BlueUserIcon />}
                  <span className="text-[#e1e1e1] truncate font-normal">{row.name}</span>
                </div>
                <div className="flex-1 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 truncate">{row.description}</div>
              </>
            ) : (
              <>
                <div className="w-64 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  {row.iconType === 'group' ? <YellowFolderIcon /> : <BlueUserIcon />}
                  <span className="text-[#e1e1e1] truncate font-normal">{row.group}</span>
                </div>
                <div className="w-48 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.server}</div>
                <div className="w-64 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.company}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.type}</div>
                <div className="w-40 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.auth}</div>
                <div className="w-48 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.risk}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.margin}</div>
                <div className="w-56 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.leverage}</div>
                <div className="w-24 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0">{row.currency}</div>
                <div className={`flex-1 border-b border-white/5 ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} group-hover:bg-blue-600/20`}></div>
              </>
            )}
          </div>
        ))}
        {/* Placeholder Rows to fill screen */}
        {[...Array(30)].map((_, i) => (
          <div key={i} className={`flex border-b border-black/5 opacity-40 ${ (data.length + i) % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
             <div className="w-full h-6 border-r border-black/10"></div>
          </div>
        ))}
      </div>

      {/* Bottom Tab Bar (MT5 Style) */}
      <div className="h-7 bg-[#2b2b2b] border-t border-black/40 flex items-center px-1 gap-1">
        <div className="h-[22px] px-3 bg-[#3e3e3e] text-white text-[11px] flex items-center border border-black/40 rounded-sm shadow-sm cursor-default">
          {viewType === 'Clients & Accounts' ? 'Clients & Accounts' : (viewType === 'Groups' ? 'Groups (127)' : viewType)}
        </div>
        <div className="h-[22px] px-3 text-[#999999] hover:text-[#cccccc] text-[11px] flex items-center cursor-default transition-colors">
          All {viewType}
        </div>
      </div>
      {/* Context Menu Overlay */}
      {contextMenu.visible && viewType === 'Groups' && (
        <AdminContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu({ ...contextMenu, visible: false })} 
          onAdd={onAddClick}
        />
      )}
    </div>
  );
};

export default AdminDataTable;
