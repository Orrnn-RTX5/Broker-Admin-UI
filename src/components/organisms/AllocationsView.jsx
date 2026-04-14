import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import AccountAllocationPopup from '../RIGHTCLICKJPOPUPS/AccountAllocationPopup';

const BlueSquareXIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="none" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" fill="#2563eb" />
    <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const UserGearIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="none" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#4ade80" strokeWidth="1" fill="#22c55e" fillOpacity="0.2" />
    <circle cx="12" cy="7" r="4" stroke="#4ade80" strokeWidth="1" fill="#22c55e" fillOpacity="0.2" />
    <circle cx="18" cy="16" r="3" fill="#3B82F6" />
  </svg>
);

const allocationsTopData = [
  { label: "Demo account allocation URL", value: "https://broker.com/open_account" },
  { label: "Deposit URL", value: "https://broker.com/deposit" },
  { label: "Withdrawal URL", value: "https://broker.com/withdrawal" },
];

const allocationsTableData = [
  { group: "preliminary", desc: "Preliminary Account", currency: "USD", type: "Hedged", server: "Main Trade Server", countries: "All countries", leverages: "", kyc: "Documents, Auto check", descBg: "" },
  { group: "demo\\forex-hedge-usd-01", desc: "Flexy Markets", currency: "USD", type: "Hedged", server: "Main Trade Server", countries: "All countries", leverages: "1000", kyc: "", descBg: "" },
  { group: "demo\\STD", desc: "Preliminary Account", currency: "USD", type: "Hedged", server: "Main Trade Server", countries: "All countries", leverages: "", kyc: "", descBg: "bg-red-900/60 text-red-100" },
];

const AllocationsView = () => {
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative">
      {/* Top Section - URLs list */}
      <div className="flex flex-col border-b border-black/40 bg-[color:var(--bg-app)] shrink-0">
        {allocationsTopData.map((row, idx) => (
          <div key={idx} className={`flex items-center text-[12px] border-b border-black/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/20 cursor-default h-6`}>
            <div className="w-[300px] flex items-center gap-2 px-3 border-r border-black/10 shrink-0 h-full">
              <BlueSquareXIcon />
              <span className="text-[color:var(--text-primary)] truncate">{row.label}</span>
            </div>
            <div className="flex-1 px-3 text-[color:var(--text-muted)] truncate h-full flex items-center">
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {/* Resize handle or spacer */}
      <div className="h-1 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0"></div>

      {/* Bottom Section - Data Table */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[color:var(--bg-app)]">
        {/* Table Header */}
        <div className="flex border-b border-black/40 bg-[color:var(--bg-surface-2)] sticky top-0 z-10 shadow-sm text-[11px] font-medium text-[color:var(--text-primary)]">
          <div className="w-64 px-3 py-1.5 border-r border-black/20 shrink-0">Group</div>
          <div className="w-64 px-3 py-1.5 border-r border-black/20 shrink-0">Description</div>
          <div className="w-24 px-3 py-1.5 border-r border-black/20 shrink-0">Currency</div>
          <div className="w-32 px-3 py-1.5 border-r border-black/20 shrink-0">Type</div>
          <div className="w-48 px-3 py-1.5 border-r border-black/20 shrink-0">Server</div>
          <div className="w-48 px-3 py-1.5 border-r border-black/20 shrink-0">Countries</div>
          <div className="w-32 px-3 py-1.5 border-r border-black/20 shrink-0">Leverages</div>
          <div className="w-48 px-3 py-1.5 border-r border-black/20 shrink-0">KYC Options</div>
          <div className="flex-1"></div>
        </div>
        
        <div className="flex-1 overflow-auto no-scrollbar">
          {/* Sub-header "Default" */}
          <div className="flex items-center px-3 py-1 text-[11px] font-bold text-[color:var(--text-primary)] bg-[color:var(--bg-app)] border-b border-black/10">
            Default
          </div>

          {/* Table Rows */}
          {allocationsTableData.map((row, idx) => (
            <div 
              key={idx} 
              onDoubleClick={() => setSelectedAllocation(row)}
              className={`flex text-[12px] border-b border-black/10 cursor-default transition-colors ${idx === 0 ? 'bg-[color:var(--accent-500)]/80 text-white' : idx % 2 !== 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/30 h-[22px] items-center`}
            >
              <div className="w-64 px-3 border-r border-black/10 flex items-center gap-2 shrink-0 h-full">
                <UserGearIcon />
                <span className={`truncate ${idx === 0 ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>{row.group}</span>
              </div>
              <div className={`w-64 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${row.descBg ? row.descBg : (idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]')}`}>
                {row.desc}
              </div>
              <div className={`w-24 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.currency}
              </div>
              <div className={`w-32 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.type}
              </div>
              <div className={`w-48 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.server}
              </div>
              <div className={`w-48 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.countries}
              </div>
              <div className={`w-32 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.leverages}
              </div>
              <div className={`w-48 px-3 border-r border-black/10 shrink-0 truncate h-full flex items-center ${idx === 0 ? 'text-white' : 'text-[color:var(--text-muted)]'}`}>
                {row.kyc}
              </div>
              <div className="flex-1 border-b border-white/5 bg-transparent h-full"></div>
            </div>
          ))}
          
          {/* Fill space */}
          {[...Array(20)].map((_, i) => (
             <div key={i} className={`flex border-b border-black/5 opacity-40 ${ (allocationsTableData.length + 1 + i) % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} h-[22px]`}>
                <div className="w-full h-full border-r border-black/10"></div>
             </div>
          ))}
        </div>
      </div>
      
      {/* Bottom Tab Bar (MT5 Style) */}
      <div className="h-7 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center px-1 gap-1 shrink-0">
        <div className="h-[22px] px-3 bg-[#3e3e3e] text-white text-[11px] flex items-center border border-black/40 rounded-sm shadow-sm cursor-default">
          Allocations
        </div>
      </div>

      <AnimatePresence>
        {selectedAllocation && (
          <AccountAllocationPopup 
            group={selectedAllocation} 
            onClose={() => setSelectedAllocation(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AllocationsView;
