import React, { useState } from 'react';
import { useUsers } from '../../hooks/useAdmin';
import { useRoles } from '../../hooks/useManager';
import { Search, ChevronDown, Check, UserPlus, ShieldPlus } from 'lucide-react';
import CreateRolePopup from '../RIGHTCLICKJPOPUPS/CreateRolePopup';
import CreateManagerPopup from '../RIGHTCLICKJPOPUPS/CreateManagerPopup';

const BlueUserIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ShieldIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ManagersView = () => {
  const [activeTab, setActiveTab] = useState('Managers'); // 'Managers' | 'Roles'
  
  // Modals
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Static dummy data as requested
  const managers = [
    { login: '1001', name: 'John Doe', role: 'admin', role_id: 1, enabled: true },
    { login: '1002', name: 'Jane Smith', role: 'manager', role_id: 2, enabled: true },
    { login: '1003', name: 'Support Agent', role: 'manager', role_id: null, enabled: false }
  ];

  const roles = [
    { id: 1, role_name: 'Super Admin', description: 'Full system access', users_assigned_count: 1 },
    { id: 2, role_name: 'Risk Manager', description: 'Can view positions and accounts', users_assigned_count: 5 }
  ];

  const handleCreated = () => {
    // Reverted to dummy state, nothing to refetch
  };

  const usersLoading = false;
  const rolesLoading = false;

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Top Action Bar */}
      <div className="flex items-center px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        {activeTab === 'Managers' && (
          <button 
            onClick={() => setIsManagerModalOpen(true)}
            className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors"
          >
            <UserPlus size={12} />
            Create Manager
          </button>
        )}
        
        {activeTab === 'Roles' && (
          <button 
            onClick={() => setIsRoleModalOpen(true)}
            className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors"
          >
            <ShieldPlus size={12} />
            Create Role
          </button>
        )}
      </div>

      {/* Table Header */}
      <div className="flex border-b border-black/40 bg-[#333333] sticky top-0 z-10 shadow-sm shrink-0 select-none">
        {activeTab === 'Managers' ? (
          <>
            <div className="w-32 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Login</div>
            <div className="w-48 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Name</div>
            <div className="w-48 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Role</div>
            <div className="w-32 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Status</div>
            <div className="flex-1 px-3 py-1.5 bg-[#333333]"></div>
          </>
        ) : (
          <>
            <div className="w-48 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Role Name</div>
            <div className="w-64 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Description</div>
            <div className="w-32 px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Users Assigned</div>
            <div className="flex-1 px-3 py-1.5 bg-[#333333]"></div>
          </>
        )}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
        
        {activeTab === 'Managers' && managers.map((row, idx) => (
          <div key={row.login} className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20`}>
            <div className="w-32 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
              <BlueUserIcon />
              <span className="text-[#e1e1e1] truncate font-normal">{row.login}</span>
            </div>
            <div className="w-48 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.name}</div>
            <div className="w-48 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.role_id ? `Role ID: ${row.role_id}` : 'None'}</div>
            <div className="w-32 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.enabled ? 'Active' : 'Disabled'}</div>
            <div className="flex-1 border-b border-white/5 bg-transparent"></div>
          </div>
        ))}

        {activeTab === 'Roles' && roles.map((row, idx) => (
          <div key={row.id} className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20`}>
            <div className="w-48 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
              <ShieldIcon />
              <span className="text-[#e1e1e1] truncate font-normal">{row.role_name}</span>
            </div>
            <div className="w-64 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.description}</div>
            <div className="w-32 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.users_assigned_count || 0}</div>
            <div className="flex-1 border-b border-white/5 bg-transparent"></div>
          </div>
        ))}

        {((activeTab === 'Managers' && usersLoading) || (activeTab === 'Roles' && rolesLoading)) && (
          <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading data...</div>
        )}

        {/* Empty Fill */}
        {[...Array(30)].map((_, i) => (
           <div key={i} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
              <div className="w-full h-6 border-r border-black/10"></div>
           </div>
        ))}
      </div>

      {/* Bottom Tab Bar (MT5 Style) */}
      <div className="h-7 bg-[#2b2b2b] border-t border-black/40 flex items-center px-1 gap-1 select-none shrink-0">
        <div 
          onClick={() => setActiveTab('Managers')}
          className={`h-[22px] px-4 text-[11px] flex items-center rounded-sm cursor-default transition-colors ${
            activeTab === 'Managers' 
              ? 'bg-[#3e3e3e] text-white border border-black/40 shadow-sm' 
              : 'text-[#999999] hover:text-[#cccccc] hover:bg-white/5'
          }`}
        >
          Managers
        </div>
        <div 
          onClick={() => setActiveTab('Roles')}
          className={`h-[22px] px-4 text-[11px] flex items-center rounded-sm cursor-default transition-colors ${
            activeTab === 'Roles' 
              ? 'bg-[#3e3e3e] text-white border border-black/40 shadow-sm' 
              : 'text-[#999999] hover:text-[#cccccc] hover:bg-white/5'
          }`}
        >
          Roles
        </div>
      </div>

      {isRoleModalOpen && <CreateRolePopup onClose={() => setIsRoleModalOpen(false)} onCreated={handleCreated} />}
      {isManagerModalOpen && <CreateManagerPopup onClose={() => setIsManagerModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
};

export default ManagersView;
