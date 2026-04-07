import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, X, Monitor } from 'lucide-react';

const ServerIcon = () => (
    <div className="flex flex-col gap-[2px] shrink-0 mt-[2px]">
        <div className="w-[38px] h-[10px] bg-[#10b981] rounded-[2px] relative shadow-sm">
            <div className="absolute right-1.5 top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
            <div className="absolute right-[14px] top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
        </div>
        <div className="w-[38px] h-[10px] bg-[#10b981] rounded-[2px] relative shadow-sm">
            <div className="absolute right-1.5 top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
            <div className="absolute right-[14px] top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
        </div>
        <div className="w-[38px] h-[10px] bg-[#10b981] rounded-[2px] relative shadow-sm">
            <div className="absolute left-[-2px] bottom-[-2px] w-[42px] h-[6px] bg-[#059669] rounded-[2px] opacity-80 -z-10"></div>
            <div className="absolute right-1.5 top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
            <div className="absolute right-[14px] top-[3px] w-[3px] h-[3px] bg-white rounded-full"></div>
        </div>
    </div>
);

const CommonTab = () => (
    <div className="flex flex-col h-full pl-3 pt-3">
        <div className="flex gap-4 items-start">
            <ServerIcon />
            <div className="text-[11px] text-[#e1e1e1] leading-[1.3] pr-8 pt-1">
                Please specify common server settings: type, name, internal identifier, password, geographical coordinates and optimization time.
            </div>
        </div>
        <div className="mt-8 flex flex-col gap-[14px] max-w-[420px] ml-11">
            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Type:</span>
                <div className="flex-1 h-full border border-[#000] bg-[#2d2d2d] text-[#888] flex items-center px-1.5 text-[11px] justify-between cursor-not-allowed shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                    Backup Server <ChevronDown size={14} className="opacity-50"/>
                </div>
            </div>
            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Name:</span>
                <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none focus:border-[#00a2e8] focus:bg-[#003859] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="MainTrade Backup Server" />
            </div>
            
            <div className="flex items-center gap-4 h-[22px]">
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">ID:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="5" />
                </div>
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[60px] text-right text-[11px] text-[#e1e1e1] pr-1">Password:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" type="password" defaultValue="password123" />
                </div>
            </div>

            <div className="flex items-center gap-4 h-[22px] mt-2">
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Latitude:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="52.37590000" />
                </div>
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[60px] text-right text-[11px] text-[#e1e1e1] pr-1">Longitude:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="4.89750000" />
                </div>
            </div>

            <div className="flex items-center gap-2 h-[22px] mt-2">
                <span className="w-[100px] text-right text-[11px] text-[#e1e1e1]">Optimization time:</span>
                <div className="relative w-[54px] h-full">
                   <input className="w-full h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="03:47" />
                   <div className="absolute right-[1px] top-[1px] bottom-[1px] w-[15px] flex flex-col border-l border-[#444] bg-[#333]">
                      <div className="flex-1 flex items-center justify-center border-b border-[#444] cursor-pointer hover:bg-[#4a4a4a]"><ChevronUp size={10} className="text-[#a0a0a0]" /></div>
                      <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#4a4a4a]"><ChevronDown size={10} className="text-[#a0a0a0]" /></div>
                   </div>
                </div>
            </div>
        </div>
    </div>
);

const NetworkTab = () => (
    <div className="flex flex-col h-full pl-3 pt-3">
        <div className="flex gap-4 items-start">
            <ServerIcon />
            <div className="text-[11px] text-[#e1e1e1] leading-[1.3] pr-8 pt-1">
                Please specify network settings of the server: outgoing address, public addresses, and bindings.
            </div>
        </div>
        
        <div className="mt-5 flex flex-col ml-1">
           <div className="text-[11px] text-[#e1e1e1] mb-3">The following IPv4 and IPv6 addresses are used for outgoing connections from this server.</div>
           <div className="flex items-center gap-2 h-[22px]">
              <span className="text-[11px] text-[#e1e1e1] ml-6 mr-1">Address:</span>
              <div className="w-[200px] h-full border border-[#555] bg-[#1a1a1a] flex items-center justify-between text-[11px] p-[1px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] cursor-pointer">
                 <span className="bg-[#00609c] text-white px-1.5 h-full flex items-center w-[85%]">89.21.67.29</span>
                 <div className="w-[16px] h-full bg-[#333] border-l border-[#444] flex items-center justify-center hover:bg-[#444]">
                    <ChevronDown size={12} className="text-[#a0a0a0]" />
                 </div>
              </div>
              <div className="w-[180px] h-full border border-[#000] bg-[#2d2d2d] flex items-center justify-between text-[11px] p-[1px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ml-2 cursor-not-allowed">
                 <div className="w-[16px] h-full ml-auto bg-[#2d2d2d] border-l border-[#1a1a1a] flex items-center justify-center">
                    <ChevronDown size={12} className="opacity-30" />
                 </div>
              </div>
           </div>
        </div>

        <div className="flex gap-4 mt-5 h-[140px] pr-3 ml-[2px]">
            <div className="flex-1 flex flex-col gap-2">
               <span className="text-[11px] text-[#e1e1e1]">Listen on these IP addresses</span>
               <div className="flex gap-2 h-full">
                  <div className="flex-1 border border-[#555] bg-[#1a1a1a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                     <div className="px-1.5 py-[3px] flex items-center gap-1.5 text-[11px] text-white bg-[#00609c] cursor-default select-none"><Monitor size={11} className="text-[#4ade80]" /> 0.0.0.0:440</div>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-[1px] w-[64px]">
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Add</button>
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Edit</button>
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Delete</button>
                  </div>
               </div>
            </div>

            <div className="flex-1 flex flex-col gap-2">
               <div className="flex items-center gap-1.5 h-[16px]">
                  <input type="checkbox" defaultChecked className="accent-cyan-500 rounded-sm w-3 h-3 appearance-none border border-[#fff] checked:bg-[#00a2e8] bg-[#e1e1e1] cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-[9px] checked:before:left-[1px] checked:before:top-[-1px]" />
                  <span className="text-[11px] text-[#e1e1e1]">Automatically use as public addresses</span>
               </div>
               <div className="flex gap-2 h-full">
                  <div className="flex-1 border border-[#555] bg-[#1a1a1a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                     <div className="px-1.5 py-[3px] flex items-center gap-1.5 text-[11px] text-white bg-[#003859] cursor-default select-none"><Monitor size={11} className="text-[#4ade80]" /> 89.21.67.29:440</div>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-[1px] w-[64px]">
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Add</button>
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Edit</button>
                     <button className="flex-1 border border-[#555] rounded-[2px] bg-[#333] text-[#e1e1e1] text-[11px] hover:bg-[#444] hover:border-[#666]">Delete</button>
                  </div>
               </div>
            </div>
        </div>
    </div>
);

const BackupTab = () => (
    <div className="flex flex-col h-full pl-3 pt-3">
        <div className="flex gap-4 items-start">
            <ServerIcon />
            <div className="text-[11px] text-[#e1e1e1] leading-[1.3] pr-8 pt-1">
                Backup server is used for backup of trade and history servers. Please specify the name of server to be reserved and backup settings.
            </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 max-w-[500px] ml-5">
            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[100px] text-right text-[11px] text-[#e1e1e1]">Master server:</span>
                <div className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white flex items-center px-1.5 text-[11px] justify-between cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                    Main Trade Server, 1 
                    <div className="w-[16px] h-[20px] bg-[#333] border-l border-[#444] flex items-center justify-center hover:bg-[#444] absolute right-[45px]">
                       <ChevronDown size={12} className="text-[#a0a0a0]"/>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col gap-2.5 ml-[108px] mt-1">
               <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="accent-cyan-500 rounded-sm w-3 h-3 appearance-none border border-[#fff] checked:bg-[#00a2e8] bg-[#e1e1e1] cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-[9px] checked:before:left-[1px] checked:before:top-[-1px] shadow-sm" />
                  <span className="text-[11px] text-[#e1e1e1]">Use this backup server for automated failover</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="accent-cyan-500 rounded-sm w-3 h-3 appearance-none border border-[#fff] checked:bg-[#00a2e8] bg-[#e1e1e1] cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-[9px] checked:before:left-[1px] checked:before:top-[-1px] shadow-sm" />
                  <span className="text-[11px] text-[#e1e1e1]">Synchronize journals with master server</span>
               </div>
               <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" defaultChecked className="accent-cyan-500 rounded-sm w-3 h-3 appearance-none border border-[#fff] checked:bg-[#00a2e8] bg-[#e1e1e1] cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-[9px] checked:before:left-[1px] checked:before:top-[-1px] shadow-sm" />
                  <span className="text-[11px] text-[#e1e1e1]">Enable backups</span>
               </div>
            </div>

            <div className="flex items-center gap-2 h-[22px] mt-2">
                <span className="w-[100px] text-right text-[11px] text-[#e1e1e1]">Backups path:</span>
                <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="D:\MetaTrader5Backup\TradeMain" />
            </div>

            <div className="flex items-center gap-6 h-[22px] mt-2">
                <div className="flex items-center gap-2">
                    <span className="w-[100px] text-right text-[11px] text-[#e1e1e1]">Backup time:</span>
                    <div className="relative w-[54px] h-full">
                       <input className="w-full h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" defaultValue="00:17" />
                       <div className="absolute right-[1px] top-[1px] bottom-[1px] w-[15px] flex flex-col border-l border-[#444] bg-[#333]">
                          <div className="flex-1 flex items-center justify-center border-b border-[#444] cursor-pointer hover:bg-[#4a4a4a]"><ChevronUp size={10} className="text-[#a0a0a0]"/></div>
                          <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#4a4a4a]"><ChevronDown size={10} className="text-[#a0a0a0]"/></div>
                       </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-1 h-[22px]">
                    <span className="w-[90px] text-right text-[11px] text-[#e1e1e1]">Additional backups:</span>
                    <div className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white flex items-center px-1.5 text-[11px] justify-between cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                        Disabled 
                        <div className="w-[16px] h-full bg-[#333] border-l border-[#444] flex items-center justify-center hover:bg-[#444] absolute right-[45px]">
                           <ChevronDown size={12} className="text-[#a0a0a0]"/>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 h-[22px] mt-2">
                <span className="w-[100px] text-right text-[11px] text-[#e1e1e1]">Keep backups:</span>
                <div className="w-[90px] h-full border border-[#555] bg-[#1a1a1a] text-white flex items-center px-1.5 text-[11px] justify-between cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] relative">
                    3 days 
                    <div className="w-[16px] h-[20px] bg-[#333] border-l border-[#444] flex items-center justify-center hover:bg-[#444] absolute right-0 top-0">
                       <ChevronDown size={12} className="text-[#a0a0a0]"/>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const SQLExportTab = () => (
    <div className="flex flex-col h-full pl-3 pt-3">
        <div className="flex gap-4 items-start">
            <ServerIcon />
            <div className="text-[11px] text-[#e1e1e1] leading-[1.3] pr-8 pt-1">
                Please specify settings for exporting databases of the backup server to an SQL database.
            </div>
        </div>
        <div className="mt-8 flex flex-col gap-[14px] max-w-[420px] ml-11">
            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Type:</span>
                <div className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white flex items-center px-1.5 text-[11px] justify-between cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] relative">
                    None 
                    <div className="w-[16px] h-[20px] bg-[#333] border-l border-[#444] flex items-center justify-center hover:bg-[#444] absolute right-0 top-0">
                       <ChevronDown size={12} className="text-[#a0a0a0]"/>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Server:</span>
                <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
            
            <div className="flex items-center gap-4 h-[22px]">
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Login:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="flex items-center gap-2 flex-1 h-full">
                    <span className="w-[60px] text-right text-[11px] text-[#e1e1e1] pr-1">Password:</span>
                    <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" type="password" />
                </div>
            </div>

            <div className="flex items-center gap-2 h-[22px]">
                <span className="w-[70px] text-right text-[11px] text-[#e1e1e1]">Database:</span>
                <input className="flex-1 h-full border border-[#555] bg-[#1a1a1a] text-white px-1.5 text-[11px] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
        </div>
    </div>
);

const ServerPropertiesPopup = ({ isOpen, onClose, serverName = "MainTrade Backup Server", serverId = "5" }) => {
    const [activeTab, setActiveTab] = useState('Common');

    if (!isOpen) return null;

    const tabs = ['Common', 'Network', 'Backup', 'SQL Export', 'SQL Options', 'Folders', 'Service'];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-transparent drop-shadow-2xl">
           <div 
               className="w-[580px] h-[375px] bg-[#1e1e1e] border border-[#444] rounded shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col font-sans overflow-hidden"
               style={{ animation: 'fade-in-scale 120ms ease-out forwards' }}
           >
              {/* Native Window Title Bar Mock */}
              <div className="h-[28px] bg-[#1a1a1a] flex items-center justify-between pl-3 pr-1 cursor-move shrink-0">
                  <div className="text-[12px] text-[#e1e1e1] tracking-wide font-sans">Server: {serverName} - ID {serverId}</div>
                  <div className="flex gap-0.5">
                      <div className="w-[32px] h-[24px] flex items-center justify-center hover:bg-[#333] transition-colors cursor-default"><div className="w-[10px] h-[1px] bg-[#e1e1e1]"></div></div>
                      <div className="w-[32px] h-[24px] flex items-center justify-center hover:bg-[#333] transition-colors cursor-default"><div className="w-[10px] h-[10px] border border-[#e1e1e1]"></div></div>
                      <div className="w-[32px] h-[24px] flex items-center justify-center hover:bg-[#e81123] hover:text-white transition-colors cursor-default text-[#e1e1e1]" onClick={onClose}><X size={14} strokeWidth={1.5}/></div>
                  </div>
              </div>

              {/* Sub Navigation Tabs */}
              <div className="flex items-center px-1 pt-[1px] bg-[#1a1a1a] shrink-0 pointer-events-auto">
                  {tabs.map((t, idx) => (
                      <div key={t} 
                           onClick={() => setActiveTab(t)}
                           className={`text-[11.5px] px-2.5 pb-[5px] pt-1.5 cursor-pointer relative ${activeTab === t ? 'text-white' : 'text-[#e1e1e1] hover:text-[#00a2e8]'}`}>
                          {t}
                          {activeTab === t && <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#00a2e8]" />}
                      </div>
                  ))}
              </div>

              {/* Content Canvas */}
              <div className="flex-1 bg-[#222222] border-t border-[#333] relative">
                  {activeTab === 'Common' && <CommonTab />}
                  {activeTab === 'Network' && <NetworkTab />}
                  {activeTab === 'Backup' && <BackupTab />}
                  {activeTab === 'SQL Export' && <SQLExportTab />}
                  {(activeTab === 'SQL Options' || activeTab === 'Folders' || activeTab === 'Service') && (
                      <div className="flex items-center justify-center h-full text-[#a0a0a0] text-[11px]">No configuration available</div>
                  )}
              </div>

              {/* Action Footer */}
              <div className="h-[46px] border-t border-[#333] flex items-center justify-end px-3 gap-[6px] bg-[#1a1a1a] shrink-0">
                  <button className="w-[75px] h-[23px] border border-[#666] outline outline-1 outline-offset-1 outline-transparent focus:outline-[#00a2e8] rounded-[2px] bg-[#2d2d2d] text-[#e1e1e1] text-[11.5px] hover:bg-[#444] hover:border-[#888] shadow-sm ml-2">OK</button>
                  <button className="w-[75px] h-[23px] border border-[#666] rounded-[2px] bg-[#2d2d2d] text-[#e1e1e1] text-[11.5px] hover:bg-[#444] hover:border-[#888] shadow-sm" onClick={onClose}>Cancel</button>
                  <button className="w-[75px] h-[23px] border border-[#666] rounded-[2px] bg-[#2d2d2d] text-[#e1e1e1] text-[11.5px] hover:bg-[#444] hover:border-[#888] shadow-sm ml-2">Help</button>
              </div>
           </div>
        </div>
    )
}

export default ServerPropertiesPopup;
