import { toggleRolePermission } from '../../utils/groupAccess';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { ROLE_PERMISSION_OPTIONS } from '../../utils/permissions';

const MotionDiv = motion.div;

const emptyPermissionMap = () =>
  Object.fromEntries(ROLE_PERMISSION_OPTIONS.map(({ key }) => [key, false]));

const CreateRolePopup = ({ onClose, onCreated }) => {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState(() => emptyPermissionMap());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const togglePermission = (key, checked) => {
    setPermissions((current) => current[key] === checked ? current : toggleRolePermission(current,key));
  };

  const handleSubmit = async () => {
    if (!roleName) {
      setError('Role name is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      await ManagerService.createRole({
        role_name: roleName,
        description,
        permissions,
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Error creating role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="w-[450px] bg-[color:var(--bg-app)] border border-[color:var(--bg-surface-3)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center h-8 bg-[color:var(--bg-app)] px-3 border-b border-white/5 select-none">
          <div className="text-[12px] text-[color:var(--text-primary)]">Create Role</div>
          <button onClick={onClose} className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[color:var(--text-muted)] transition-colors rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-[color:var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right">Role Name:</label>
            <input 
              type="text" 
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Dealer..."
              className="flex-1 bg-[color:var(--bg-app)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm"
              autoFocus
            />
          </div>
          
          <div className="flex items-start gap-3">
            <label className="text-[12px] w-24 shrink-0 text-right mt-1">Description:</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 h-16 bg-[color:var(--bg-app)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-white focus:outline-none focus:border-blue-500 rounded-sm resize-none"
            />
          </div>

          <div className="flex items-start gap-3 mt-2">
            <label className="text-[12px] w-24 shrink-0 text-right">Permissions:</label>
            <div className="flex-1 flex flex-col gap-2">
              {ROLE_PERMISSION_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer outline-none">
                  <input
                    type="checkbox"
                    checked={permissions[key]}
                    onChange={(e) => togglePermission(key, e.target.checked)}
                    className="accent-blue-500 w-3 h-3 cursor-pointer"
                  />
                  <span className="text-[12px]">{label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {error && <div className="text-red-400 text-[11px] text-center mt-2">{error}</div>}
        </div>

        <div className="px-4 py-3 bg-[color:var(--bg-app)] flex justify-end gap-2 border-t border-white/5 select-none">
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 h-[24px] bg-[color:var(--accent-500)] text-white border border-transparent rounded text-[12px] hover:bg-[color:var(--accent-500)] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={onClose}
            className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10 hover:border-[#777777] transition-all"
          >
            Cancel
          </button>
        </div>
      </MotionDiv>
    </div>
  );
};

export default CreateRolePopup;
