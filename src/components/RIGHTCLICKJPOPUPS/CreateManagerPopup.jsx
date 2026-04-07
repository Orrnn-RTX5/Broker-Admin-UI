import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { useRoles } from '../../hooks/useManager';

const CreateManagerPopup = ({ onClose, onCreated }) => {
  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [allowedGroups, setAllowedGroups] = useState('std_ecn');
  const [ipWhitelist, setIpWhitelist] = useState('192.168.1.0/24');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: rolesResponse } = useRoles();
  const roles = rolesResponse?.roles || [];

  const handleSubmit = async () => {
    if (!login || !name || !password || !roleId) {
      setError('Login, Name, Password, and Role are required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await ManagerService.createManager({
        login: parseInt(login, 10),
        name,
        password,
        is_admin: isAdmin,
        role_id: parseInt(roleId, 10),
        allowed_groups: allowedGroups ? allowedGroups.split(',').map(s => s.trim()) : [],
        ip_whitelist: ipWhitelist ? ipWhitelist.split(',').map(s => s.trim()) : []
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Error creating manager');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="w-[450px] bg-[#1e1e1e] border border-[#444444] rounded-[6px] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center h-8 bg-[#1e1e1e] px-3 border-b border-white/5 select-none">
          <div className="text-[12px] text-[#e1e1e1]">Create Manager</div>
          <button onClick={onClose} className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[#aaaaaa] transition-colors rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-[#cccccc]">
          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Login (ID):</label>
            <input 
              type="number" 
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
              autoFocus
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Name:</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Password:</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Role:</label>
            <select 
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="flex-1 bg-[#252526] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm cursor-pointer"
            >
              <option value="" disabled>Select Role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.role_name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Allowed Groups:</label>
            <input 
              type="text" 
              value={allowedGroups}
              onChange={(e) => setAllowedGroups(e.target.value)}
              placeholder="e.g. std_ecn, real_account"
              className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">IP Whitelist:</label>
            <input 
              type="text" 
              value={ipWhitelist}
              onChange={(e) => setIpWhitelist(e.target.value)}
              placeholder="e.g. 192.168.1.0/24"
              className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
            />
          </div>

          <div className="flex items-center gap-3 mt-1">
            <label className="text-[12px] w-24 shrink-0 text-right">System Admin:</label>
            <label className="flex items-center gap-2 cursor-pointer outline-none pl-1">
              <input 
                type="checkbox" 
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="accent-blue-500 w-3 h-3 cursor-pointer"
              />
              <span className="text-[11px] text-[#aaaaaa] italic">Requires full privileges</span>
            </label>
          </div>
          
          {error && <div className="text-red-400 text-[11px] text-center mt-2">{error}</div>}
        </div>

        <div className="px-4 py-3 bg-[#1e1e1e] flex justify-end gap-2 border-t border-white/5 select-none">
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 h-[24px] bg-[#007acc] text-white border border-transparent rounded text-[12px] hover:bg-[#0098ff] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={onClose}
            className="px-6 h-[24px] bg-transparent border border-[#555555] rounded text-[12px] text-white hover:bg-white/10 hover:border-[#777777] transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateManagerPopup;
