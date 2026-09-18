import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { useRoles } from '../../hooks/useManager';

const MotionDiv = motion.div;

const BlueUserLargeIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="#3B82F6" />
    <circle cx="12" cy="7" r="4" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" />
    {/* Hat symbol adding custom flair from screenshot */}
    <path d="M6 8l1-3h10l1 3M4 8h16v2H4z" fill="#0EA5E9" stroke="#0284C7" />
  </svg>
);

const CheckboxIcon = ({ checked, indeterminate, isRedCross }) => {
  if (isRedCross) {
    return (
      <div className="w-[13px] h-[13px] border border-black/40 rounded-[2px] bg-white flex items-center justify-center">
         <X size={10} className="text-red-500" />
      </div>
    );
  }
  return (
    <div className={`w-[13px] h-[13px] border border-black/40 rounded-[2px] bg-white flex items-center justify-center ${indeterminate ? 'bg-gray-200' : ''}`}>
      {checked && <Check size={10} className="text-blue-500" strokeWidth={3} />}
      {!checked && indeterminate && <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>}
    </div>
  );
};

const ManagerPropertiesPopup = ({ manager, onClose }) => {
  const [activeTab, setActiveTab] = useState('Common');
  const [roleId, setRoleId] = useState(() => manager?.role_id || '');

  const { data: rolesResponse } = useRoles();
  const roles = rolesResponse?.roles || [];

  const handleSave = async () => {
    try {
      if (roleId && roleId !== manager?.role_id) {
        await ManagerService.updateManagerRole(manager.login, roleId);
      }
      onClose();
    } catch (err) {
      alert("Failed to update manager settings: " + err.message);
    }
  };

  const tabs = ['Common', 'Permissions', 'Reports', 'IP Access List'];

  const renderContent = () => {
    switch (activeTab) {
      case 'Common':
        return (
          <div className="flex-1 flex flex-col overflow-hidden pt-2 text-[color:var(--text-secondary)]">
            <div className="flex gap-4 flex-1 overflow-hidden">
              <div className="w-16 flex flex-col items-center gap-4 shrink-0">
                <BlueUserLargeIcon />
                <div className="mt-auto flex flex-col gap-1.5 w-full pb-2">
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Add</button>
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Edit</button>
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Delete</button>
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <p className="text-[12px] mb-4 leading-snug pr-4">
                  Managers control platform settings, accounts and trading operations. To add a manager, create a trading account in the 'managers' or 'administrators' group and specify its login in this tab. Then configure access to client groups.
                </p>
                <div className="flex gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[12px]">Login:</label>
                    <input
                      type="text"
                      defaultValue={manager?.login || "900546"}
                      className="bg-transparent border border-[color:var(--border-strong)] px-1 py-0.5 text-[12px] w-32 focus:outline-none focus:border-blue-500 text-[color:var(--text-primary)]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[12px]">Mailbox name:</label>
                    <input
                      type="text"
                      className="bg-transparent border border-[color:var(--border-strong)] px-1 py-0.5 text-[12px] w-48 focus:outline-none focus:border-blue-500 text-[color:var(--text-primary)]"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-1 min-h-0">
                  <label className="text-[12px] mt-1 shrink-0">Groups:</label>
                  <div className="flex-1 border border-[color:var(--border-strong)] bg-transparent overflow-y-auto min-h-0">
                    <div className="bg-[color:var(--bg-surface-1)] px-2 py-1 flex items-center text-[12px] text-[color:var(--text-primary)] hover:bg-blue-600/30 cursor-pointer">
                      <span className="text-blue-400 mr-2">👥</span> demo\Propfirm
                    </div>
                    <div className="px-2 py-1 flex items-center text-[12px] text-[color:var(--text-primary)] hover:bg-blue-600/30 cursor-pointer border-t border-[color:var(--bg-surface-2)]">
                      <span className="text-blue-400 mr-2">👥</span> Demo\propfirm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Permissions':
        return (
          <div className="flex-1 flex flex-col overflow-hidden pt-2 text-[color:var(--text-secondary)]">
             <div className="flex gap-4 flex-1 overflow-hidden">
              <div className="w-16 flex flex-col items-center gap-4 shrink-0">
                <BlueUserLargeIcon />
              </div>
              <div className="flex-1 pr-4 flex flex-col min-h-0">
                <p className="text-[12px] mb-4">
                  Set up permissions of the manager by selecting entries or a previously saved set.
                </p>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] whitespace-nowrap">Available logs:</span>
                    <select className="bg-transparent border border-[color:var(--border-strong)] text-[12px] px-1 py-0.5 text-[color:var(--text-primary)] w-28 outline-none">
                      <option>All</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] whitespace-nowrap">Available reports:</span>
                    <select className="bg-transparent border border-[color:var(--border-strong)] text-[12px] px-1 py-0.5 text-[color:var(--text-primary)] w-28 outline-none">
                      <option>All</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] w-8">Role:</span>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="bg-transparent border border-[color:var(--border-strong)] text-[12px] px-1 py-0.5 text-[color:var(--text-primary)] w-48 outline-none shrink-0"
                  >
                    <option value="">Select Role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.role_name}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex gap-2 w-full justify-end">
                    <button className="px-3 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] whitespace-nowrap">Save As</button>
                    <button className="px-3 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] whitespace-nowrap">Delete</button>
                  </div>
                </div>
                <div className="flex gap-2 flex-1 min-h-0">
                  <label className="text-[12px] w-16 shrink-0">Permissions:</label>
                  <div className="flex-1 border border-[color:var(--border-strong)] bg-transparent overflow-y-auto pt-1 pb-2 min-h-0">

                    {/* Tree Node 1 */}
                    <div className="px-2 flex flex-col">
                      <div className="flex items-center gap-1.5 py-[2px] hover:bg-white/5">
                        <span className="text-[color:var(--text-muted)] text-[10px] w-3 flex justify-center">v</span>
                        <CheckboxIcon indeterminate={true} />
                        <span className="text-[12px] text-[color:var(--text-primary)]">Connection type</span>
                      </div>
                      <div className="pl-6 flex flex-col border-l border-dotted border-[color:var(--text-muted)] ml-2.5">
                        <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                          <CheckboxIcon isRedCross={true} />
                          <span className="text-[12px] text-[color:var(--text-primary)]">Connect using RTX5 Administrator</span>
                        </div>
                        <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                          <CheckboxIcon checked={true} />
                          <span className="text-[12px] text-[color:var(--text-primary)]">Connect using RTX5 Manager</span>
                        </div>
                      </div>
                    </div>
                    {/* Tree Node 2 */}
                    <div className="px-2 flex flex-col mt-1">
                      <div className="flex items-center gap-1.5 py-[2px] hover:bg-white/5">
                        <span className="text-[color:var(--text-muted)] text-[10px] w-3 flex justify-center">v</span>
                        <CheckboxIcon isRedCross={true} />
                        <span className="text-[12px] text-[color:var(--text-primary)]">Configuration setup</span>
                      </div>
                      <div className="pl-6 flex flex-col border-l border-dotted border-[color:var(--text-muted)] ml-2.5">
                        <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                          <CheckboxIcon isRedCross={true} />
                          <span className="text-[12px] text-[color:var(--text-primary)]">Configure network</span>
                        </div>
                        <div className="flex flex-col relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-[11px] hover:bg-white/5">
                          <div className="flex items-center gap-1.5 py-[2px]">
                            <span className="text-[color:var(--text-muted)] text-[10px] w-3 flex justify-center absolute -left-4">v</span>
                            <CheckboxIcon isRedCross={true} />
                            <span className="text-[12px] text-[color:var(--text-primary)]">Configure integrations</span>
                          </div>
                          <div className="pl-6 flex flex-col border-l border-dotted border-[color:var(--text-muted)] ml-[5px]">
                            <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                              <CheckboxIcon isRedCross={true} />
                              <span className="text-[12px] text-[color:var(--text-primary)]">Configure sponsored VPS</span>
                            </div>
                            <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                              <CheckboxIcon isRedCross={true} />
                              <span className="text-[12px] text-[color:var(--text-primary)]">Configure mail servers</span>
                            </div>
                            <div className="flex items-center gap-1.5 py-[2px] relative before:absolute before:content-[''] before:w-3.5 before:h-[1px] before:border-t before:border-dotted before:border-[color:var(--text-muted)] before:-left-1.5 before:top-1/2 hover:bg-white/5">
                              <CheckboxIcon isRedCross={true} />
                              <span className="text-[12px] text-[color:var(--text-primary)]">Configure SMS gateways and messenger channels</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Reports':
        return (
          <div className="flex-1 flex flex-col overflow-hidden pt-2 text-[color:var(--text-secondary)]">
            <div className="flex gap-4 flex-1 overflow-hidden">
              <div className="w-16 flex flex-col items-center gap-4 shrink-0">
                 <BlueUserLargeIcon />
                 <div className="flex flex-col gap-1.5 mt-2">
                   <button className="w-14 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Up</button>
                   <button className="w-14 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Down</button>
                 </div>
                 <div className="mt-auto flex flex-col gap-1.5">
                   <button className="w-14 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Add</button>
                   <button className="w-14 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Edit</button>
                   <button className="w-14 h-[22px] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Delete</button>
                 </div>
              </div>
              <div className="flex-1 pr-4 flex flex-col min-h-0">
                <p className="text-[12px] mb-2 leading-snug shrink-0">
                  Set up access to the server reports for the manager, including the ability to save reports to files and the amount of available data. You can provide access to individual reports or groups of reports.
                </p>
                <div className="border border-[color:var(--border-strong)] flex-1 bg-transparent mt-2 overflow-y-auto min-h-0">
                  <div className="flex border-b border-[color:var(--border-strong)] text-[11px] text-[color:var(--text-primary)] bg-[color:var(--bg-surface-2)] sticky top-0 py-1 px-2 z-10">
                    <div className="flex-1">Reports</div>
                    <div className="w-12 text-center">View</div>
                    <div className="w-12 text-center">Ex...</div>
                    <div className="w-24 text-right">History, days</div>
                  </div>

                  {/* Row 1 */}
                  <div className="flex items-center py-1 px-2 border-b border-[color:var(--bg-surface-2)] hover:bg-blue-600/30">
                    <div className="flex-1 flex items-center text-[12px] text-[color:var(--text-primary)]">
                      <span className="text-yellow-500 mr-1.5">📁</span> *
                    </div>
                    <div className="w-12 flex justify-center"><CheckboxIcon checked={true} /></div>
                    <div className="w-12 flex justify-center"><CheckboxIcon checked={true} /></div>
                    <div className="w-24 text-right text-[12px] text-[color:var(--text-secondary)]">Default: All</div>
                  </div>
                  {/* Row 2 */}
                  <div className="flex items-center py-1 px-2 border-b border-[color:var(--bg-surface-2)] hover:bg-blue-600/30">
                    <div className="flex-1 flex items-center text-[12px] text-[color:var(--text-primary)]">
                      <span className="text-yellow-500 mr-1.5">📁</span> *
                    </div>
                    <div className="w-12 flex justify-center"><CheckboxIcon checked={true} /></div>
                    <div className="w-12 flex justify-center"><CheckboxIcon checked={true} /></div>
                    <div className="w-24 text-right text-[12px] text-[color:var(--text-secondary)]">Default: All</div>
                  </div>
                  {/* Add Row */}
                  <div className="flex items-center py-1 px-2 border-b border-[color:var(--bg-surface-2)] hover:bg-white/5 cursor-pointer">
                    <div className="flex-1 flex items-center text-[12px] text-green-500">
                      <span className="mr-1.5">+</span> click to add...
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      case 'IP Access List':
        return (
          <div className="flex-1 flex flex-col overflow-hidden pt-2 text-[color:var(--text-secondary)]">
            <div className="flex gap-4 flex-1 overflow-hidden">
              <div className="w-16 flex flex-col items-center gap-4 shrink-0">
                 <BlueUserLargeIcon />
                 <div className="mt-auto flex flex-col gap-1.5 w-full pb-2">
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Add</button>
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Edit</button>
                   <button className="w-full h-[22px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] rounded text-[11px] text-[color:var(--text-primary)]">Delete</button>
                 </div>
              </div>
              <div className="flex-1 pr-4 flex flex-col min-h-0">
                <p className="text-[12px] mb-4 leading-snug shrink-0">
                  The adjustment of access list is intended for limitation of manager access to the system by IP addresses. Please specify the range of allowed addresses.
                </p>
                <div className="border border-[color:var(--border-strong)] flex-1 bg-transparent mt-2 overflow-y-auto min-h-0">
                  <div className="flex border-b border-[color:var(--border-strong)] text-[11px] text-[color:var(--text-primary)] bg-[color:var(--bg-surface-2)] sticky top-0 py-1 px-2 z-10">
                    <div className="flex-1">From</div>
                    <div className="flex-1">To</div>
                  </div>

                  <div className="flex items-center py-1 px-2 border-b border-[color:var(--bg-surface-2)] hover:bg-blue-600/30">
                    <div className="flex-1 flex items-center text-[12px] text-[color:var(--text-primary)]">
                      <span className="text-green-500 mr-2 border border-green-500 rounded-sm w-[14px] h-[10px] relative"><span className="absolute top-[2px] left-[-2px] w-[16px] border-b border-green-500"></span></span> 81.29.145.69
                    </div>
                    <div className="flex-1 text-[12px] text-[color:var(--text-primary)]">81.29.145.69</div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="w-[550px] h-[460px] bg-[color:var(--bg-app)] border border-[color:var(--bg-surface-3)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden transform"
        style={{
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'
        }}
      >
        {/* Title Bar */}
        <div className="flex justify-between items-center h-8 bg-[color:var(--bg-app)] px-3 cursor-move border-b border-white/5">
          <div className="text-[12px] text-[color:var(--text-primary)] flex items-center gap-2">
            Manager: {manager?.name || "Propfirm"}
          </div>
          <div className="flex gap-2">
             <button className="w-[28px] h-[20px] flex items-center justify-center hover:bg-white/10 text-[color:var(--text-muted)]">
               <div className="w-[10px] h-[1px] bg-current"></div>
             </button>
             <button className="w-[28px] h-[20px] flex items-center justify-center hover:bg-white/10 text-[color:var(--text-muted)]">
               <div className="w-[10px] h-[10px] border border-current"></div>
             </button>
             <button onClick={onClose} className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[color:var(--text-muted)] transition-colors rounded-tr-[4px]">
               <X size={12} />
             </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex px-1 bg-[color:var(--bg-app)] border-b border-[color:var(--bg-surface-2)] pt-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[12px] relative ${
                activeTab === tab
                  ? 'text-[color:var(--text-primary)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] hover:bg-white/5'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#3B82F6]"></div>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative px-3 py-2 bg-[color:var(--bg-app)] min-h-0 overflow-hidden">
          {renderContent()}
        </div>

        {/* Bottom Action Bar */}
        <div className="px-3 pb-3 pt-2 bg-[color:var(--bg-app)] flex justify-end gap-2 shrink-0 border-t border-white/5">
          <button
            onClick={handleSave}
            className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-[color:var(--text-primary)] hover:bg-white/10 hover:border-[#777777] transition-all focus:outline-none focus:border-blue-500 focus:bg-[color:var(--bg-surface-2)]"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-[color:var(--text-primary)] hover:bg-white/10 hover:border-[#777777] transition-all focus:outline-none focus:border-blue-500 focus:bg-[color:var(--bg-surface-2)]"
          >
            Cancel
          </button>
          <button
            className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-[color:var(--text-primary)] hover:bg-white/10 hover:border-[#777777] transition-all focus:outline-none focus:border-blue-500 focus:bg-[color:var(--bg-surface-2)]"
          >
            Help
          </button>
        </div>

      </MotionDiv>
    </div>
  );
};

export default ManagerPropertiesPopup;
