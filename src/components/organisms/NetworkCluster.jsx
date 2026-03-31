import React, { useState } from 'react';
import { Server, Zap, Cpu, MemoryStick as Memory, HardDrive, Share2, Activity, Clock, ShieldAlert, BarChart3, Database, Router, CheckCircle2, Lock, List, MapPin, Cloud } from 'lucide-react';

const networkNodesData = [
  { id: 5, type: 'Backup Server', server: 'MainTrade Backup Server', ipv4: '89.21.67.29', pubAddr: '89.21.67.29:440', basePri: '', curPri: '', cpu: '0%', threads: 42, memory: '20 739', sockets: 118, connect: '', trafficIn: '0', trafficOut: '0' },
  { id: 1, type: 'Main Trade Server', server: 'Main Trade Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:440', basePri: '', curPri: '', cpu: '0%', threads: 154, memory: '46 162', sockets: 156, connect: '23', trafficIn: '0', trafficOut: '0' },
  { id: 2, type: 'Access Server', server: 'Access Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:443', basePri: '0', curPri: '0', cpu: '2%', threads: 73, memory: '46 160', sockets: 156, connect: '13', trafficIn: '0', trafficOut: '0' },
  { id: 3, type: 'History Server', server: 'History Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:441', basePri: '', curPri: '', cpu: '0%', threads: 71, memory: '46 162', sockets: 159, connect: '10', trafficIn: '0', trafficOut: '0' },
  { id: 4, type: 'Backup Server', server: 'Local Main Backup Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:442', basePri: '', curPri: '', cpu: '1%', threads: 42, memory: '46 162', sockets: 157, connect: '', trafficIn: '0', trafficOut: '0' },
  { id: 6, type: 'Backup Server', server: 'Backup Server', ipv4: '89.21.67.29', pubAddr: '89.21.67.29:441', basePri: '', curPri: '', cpu: '2%', threads: 14, memory: '20 740', sockets: 118, connect: '', trafficIn: '0', trafficOut: '0' },
  { id: 7, type: 'Access Server', server: 'Access Server', ipv4: '89.21.67.29', pubAddr: '89.21.67.29:443', basePri: '0', curPri: '0', cpu: '1%', threads: 74, memory: '20 740', sockets: 119, connect: '7', trafficIn: '0', trafficOut: '0' },
  { id: 8, type: 'Backup Server', server: 'TradeProcessor SQL_Export', ipv4: '23.106.230.130', pubAddr: '23.106.230.130:444', basePri: '', curPri: '', cpu: '0%', threads: 53, memory: '24 955', sockets: 114, connect: '', trafficIn: '0', trafficOut: '0' },
];

const renderIcon = (type) => {
  if (type === 'Main Trade Server') return <Database size={13} className="text-green-500" />;
  if (type === 'Access Server') return <Lock size={13} className="text-yellow-500" />;
  if (type === 'History Server') return <Clock size={13} className="text-blue-500" />;
  return <Database size={13} className="text-green-500" />;
};

const NetworkOverviewMap = () => (
  <div className="flex-1 bg-[#1e1e1e] relative flex items-center justify-center p-8 overflow-hidden">
    <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center pointer-events-none pb-20">
       <svg viewBox="0 0 1000 500" className="w-[85%] max-w-6xl h-auto opacity-100" style={{ fill: '#4a4a4a', stroke: '#3a3a3a', strokeWidth: '1' }}>
          {/* Approximate path for World Map */}
          <path d="M120,40 Q150,10 250,30 T350,80 T400,100 T430,70 T480,90 T520,30 T600,40 T650,20 T700,60 T750,50 T800,20 T850,70 T950,50 T980,100 T950,150 T850,200 Q800,250 820,300 T780,350 T800,400 T850,450 T920,400 T950,500 T850,480 T750,450 T700,500 T650,450 T600,400 T550,500 T520,450 T480,420 T440,350 T480,280 T400,250 T350,300 T300,450 T250,500 T200,450 T180,350 T150,300 T120,280 T80,250 T30,200 T40,150 Q50,100 120,40 Z" />
          
          {/* US highlighting overlay path */}
          <path d="M170,120 Q200,100 280,130 T320,170 T380,180 T350,220 T280,260 T250,280 T200,270 T170,240 T150,180 Z" fill="#2563eb" />
          
          {/* Alaska highlighting overlay path */}
          <path d="M50,80 Q80,50 120,70 T150,100 T120,130 T90,140 T50,120 Z" fill="#2563eb" />

          {/* India highlighting overlay path */}
          <path d="M680,240 Q710,230 730,260 T750,290 T720,350 T680,310 T660,280 Z" fill="#1e3a8a" opacity="0.8" />
       </svg>
    </div>
    
    <div className="relative z-10 w-[85%] max-w-6xl h-full pb-20 pointer-events-none">
       <div className="absolute inset-0">
          {/* Server Nodes Group - UK/Europe Area */}
          <div className="absolute top-[35%] left-[48%] flex flex-col items-center pointer-events-auto cursor-pointer">
            <div className="flex gap-0.5 mb-1">
               <div className="bg-[#4ade80] rounded-full w-[22px] h-[22px] flex items-center justify-center text-[10px] font-bold text-black border border-green-800 shadow-xl z-20">13</div>
               <div className="bg-[#a3e635] rounded-full w-[22px] h-[22px] flex items-center justify-center text-[10px] font-bold text-black border border-green-800 shadow-xl z-10 -ml-1.5 mt-0.5">7</div>
            </div>
            <div className="flex gap-0.5 -mt-1.5 pl-2 z-30">
               <div className="bg-[#4ade80] rounded-full w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-black border border-green-800 shadow-xl">5</div>
               <div className="bg-[#a3e635] rounded-full w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-black border border-green-800 shadow-xl -ml-1">3</div>
            </div>
            <div className="mt-1 bg-black px-1.5 py-0.5 rounded text-[10px] text-white font-medium border border-white/20 shadow-lg">47 ms</div>
          </div>
       </div>
    </div>
  </div>
);

const NetworkNodesTable = () => (
   <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
      <div className="flex border-b border-black/40 bg-[#333333] sticky top-0 z-10 shadow-sm text-[11px] font-medium text-[#d1d1d1]">
         <div className="w-40 px-3 py-1.5 border-r border-black/20 truncate">Type</div>
         <div className="w-48 px-3 py-1.5 border-r border-black/20 truncate">Server</div>
         <div className="w-32 px-3 py-1.5 border-r border-black/20 truncate">IPv4 Address</div>
         <div className="w-32 px-3 py-1.5 border-r border-black/20 truncate">IPv6 Address</div>
         <div className="w-40 px-3 py-1.5 border-r border-black/20 truncate">Public Addresses</div>
         <div className="w-12 px-3 py-1.5 border-r border-black/20 text-right">ID</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right truncate">Base Pri...</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right truncate">Current ...</div>
         <div className="w-16 px-3 py-1.5 border-r border-black/20 text-right">CPU</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right">Threads</div>
         <div className="w-24 px-3 py-1.5 border-r border-black/20 text-right">Memory</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right">Sockets</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right truncate">Connect...</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right truncate">Traffic In</div>
         <div className="w-20 px-3 py-1.5 border-r border-black/20 text-right truncate">Traffic Out</div>
         <div className="flex-1 bg-[#333333]"></div>
      </div>
      {networkNodesData.map((node, idx) => (
         <div key={idx} className={`flex text-[11px] border-b border-black/10 cursor-default hover:bg-blue-600/20 ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
            <div className="w-40 px-3 py-1 border-r border-black/10 flex items-center gap-1.5 truncate">
               {renderIcon(node.type)}
               <span className="text-[#e1e1e1]">{node.type}</span>
            </div>
            <div className="w-48 px-3 py-1 border-r border-black/10 text-[#d1d1d1] truncate">{node.server}</div>
            <div className="w-32 px-3 py-1 border-r border-black/10 text-[#aaaaaa]">{node.ipv4}</div>
            <div className="w-32 px-3 py-1 border-r border-black/10 text-[#aaaaaa]">{node.ipv6}</div>
            <div className="w-40 px-3 py-1 border-r border-black/10 text-[#aaaaaa]">{node.pubAddr}</div>
            <div className="w-12 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.id}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.basePri}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.curPri}</div>
            <div className="w-16 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.cpu}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.threads}</div>
            <div className="w-24 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.memory}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.sockets}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.connect}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.trafficIn}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[#aaaaaa] text-right">{node.trafficOut}</div>
            <div className="flex-1"></div>
         </div>
      ))}
      {[...Array(15)].map((_, i) => (
         <div key={i} className={`flex border-b border-black/5 opacity-40 ${ (networkNodesData.length + i) % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
            <div className="w-full h-[26px] border-r border-black/10"></div>
         </div>
      ))}
   </div>
);

const ChartGridLines = () => (
  <div className="absolute inset-x-0 bottom-0 top-6 pointer-events-none">
     {[...Array(5)].map((_, i) => (
        <div key={i} className="w-full h-[20%] border-t border-white/5 box-border"></div>
     ))}
     <div className="absolute bottom-0 w-full h-[12px] flex items-end">
        {[...Array(40)].map((_, j) => (
          <div key={j} className={`border-l border-white/30 ml-[2.5%] ${j % 4 === 0 ? 'h-full' : 'h-1/2'}`}></div>
        ))}
     </div>
  </div>
);

const NetworkGraphPanel = ({ title, type, servers }) => {
   const generatePath = (points, max, isCpu) => {
      let path = `M 0,${max}`;
      let y = isCpu ? max : max - 15;
      
      for(let i = 0; i <= points; i++) {
         const x = (i / points) * 100;
         if (isCpu) {
            const spike = Math.random() > 0.85 ? Math.random() * max * 0.9 : Math.random() * max * 0.15;
            path += ` L ${x},${Math.max(0, max - spike)}`;
         } else {
            const drop = Math.random() > 0.98 ? Math.random() * 15 : Math.random() * 1;
            y = Math.max(15, Math.min(max - 15, y + (Math.random() - 0.5) * 2));
            path += ` L ${x},${y + drop}`;
         }
      }
      return path;
   };

   return (
     <div className="flex-1 bg-[#151515] overflow-auto no-scrollbar flex flex-col">
        {servers.map((srv, idx) => (
           <div key={idx} className="h-[210px] bg-[#121212] border-b border-black/60 relative shrink-0">
              <div className="px-2 py-1 text-[11px] text-[#e1e1e1] flex items-center gap-1.5 h-6 z-10 relative mt-1 bg-[#121212]/30 w-fit rounded">
                 {renderIcon(srv.type)} <span className="font-medium tracking-wide">{srv.name}</span>
              </div>
              
              {type === 'CPU' ? (
                 <div className="px-3 text-[10px] text-blue-500 font-mono z-10 relative h-auto leading-[13px] mt-0.5">
                    <div>- CPU total: {Math.floor(Math.random() * 5)}%, 8 cores</div>
                    <div>- CPU process: 0%</div>
                    <div>- CPU DPC: 0</div>
                    <div>- CPU interrupts: 0</div>
                 </div>
              ) : (
                 <div className="px-3 text-[10px] text-blue-500 font-mono z-10 relative h-4 mt-0.5 flex flex-col">
                    <div className="flex flex-col bg-[#e0e0e0] border border-[#a0a0a0] px-1 py-0.5 w-max mb-1 items-center justify-center mt-3 shadow-sm">
                       <span className="text-black font-sans leading-tight">{srv.memory} MB</span>
                       <span className="text-black font-sans leading-tight">{Math.floor(Math.random() * 10 + 60)}.{Math.floor(Math.random() * 99)}%</span>
                    </div>
                    <div className="absolute top-0">- Free memory: {srv.memory} MB, 70.54%</div>
                 </div>
              )}
              
              <ChartGridLines />
              
              <div className="absolute inset-x-0 bottom-0 top-6 z-0 overflow-hidden ml-1 mr-6">
                 <svg className="w-full h-full" preserveAspectRatio="none">
                    <path 
                       d={generatePath(250, 100, type === 'CPU')}
                       fill="none"
                       stroke="#2563eb"
                       strokeWidth="1.2"
                       vectorEffect="non-scaling-stroke"
                    />
                    {type === 'CPU' && (
                       <path 
                          d={generatePath(250, 100, true)}
                          fill="none"
                          stroke="#65a30d"
                          strokeWidth="1"
                          opacity="0.8"
                          vectorEffect="non-scaling-stroke"
                       />
                    )}
                 </svg>
              </div>
              
              <div className="absolute right-1 top-2 text-[10px] text-gray-400">%</div>
              <div className="absolute right-1 bottom-1 flex flex-col justify-between h-[160px] text-[9px] text-gray-500 pb-2 text-right">
                 <span>100</span>
                 <span>80</span>
                 <span>60</span>
                 <span>40</span>
                 <span>20</span>
                 <span>0</span>
              </div>
              
              {/* x-axis labels on bottom graph only or every graph */}
              <div className="absolute left-1 bottom-0 h-4 text-[9px] text-[#808080] flex items-center justify-between w-[95%] pointer-events-none px-2 z-10">
                 {idx === servers.length - 1 && (
                    <>
                       <span>2026.03.27 14:00</span>
                       <span>18:00</span>
                       <span>22:00</span>
                       <span>02:00</span>
                       <span>06:00</span>
                       <span>10:00</span>
                       <span>14:00</span>
                       <span>18:00</span>
                       <span>22:00</span>
                       <span>02:00</span>
                       <span>06:00</span>
                       <span>10:00</span>
                    </>
                 )}
              </div>
           </div>
        ))}
     </div>
   );
};

const NetworkCluster = () => {
  const [topTab, setTopTab] = useState('Cluster');
  const [bottomTab, setBottomTab] = useState('Nodes');

  const topTabs = ['Cluster', 'Ultency Matching Engines', 'Hosted Access Servers', 'Sponsored VPS'];
  const bottomTabs = ['Overview', 'Nodes', 'CPU', 'Memory', 'Disk', 'Connections', 'Traffic', 'Latency', 'Network Packets', 'Trade'];

  const serversList = [
     { type: 'Backup Server', name: 'MainTrade Backup Server', memory: '20 739' },
     { type: 'Main Trade Server', name: 'Main Trade Server', memory: '46 162' },
     { type: 'Access Server', name: 'Access Server', memory: '46 160' },
     { type: 'History Server', name: 'History Server', memory: '46 162' },
     { type: 'Backup Server', name: 'Local Main Backup Server', memory: '46 162' },
  ];

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative">
      {/* Header section */}
      <div className={`px-4 pt-4 pb-0 bg-[#1e1e1e] ${bottomTab === 'Nodes' ? 'border-b border-black/40 bg-[#252526]' : 'border-b border-white/5'}`}>
        <div className="flex justify-between items-start mb-4">
           <div>
              <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
                 Network Cluster: <span className="text-[#a0a0a0] font-normal text-sm">23 online</span>
              </h2>
              {bottomTab === 'Nodes' && (
                <p className="text-[#aaaaaa] text-[12px] mt-0.5">Monitor the platform infrastructure, manage network settings, and scale the cluster for load balancing</p>
              )}
           </div>
           <div className="flex gap-2">
              <button className="px-3 py-1 bg-transparent border border-[#555555] rounded-sm text-[12px] text-[#e0e0e0] hover:bg-white/5 transition-colors">
                 Add Server
              </button>
              {bottomTab === 'Nodes' && (
                <button className="px-2 py-1 bg-transparent text-[#007acc] hover:bg-white/5 transition-colors ml-2">
                   <Router size={16} />
                </button>
              )}
              {bottomTab === 'Nodes' && (
                <button className="px-2 py-1 bg-transparent text-[#007acc] hover:bg-white/5 transition-colors">
                   <List size={16} />
                </button>
              )}
           </div>
        </div>
        
        {/* Top Tabs */}
        <div className="flex gap-6 mt-1 text-[12px]">
           {topTabs.map(tab => (
              <div 
                 key={tab}
                 onClick={() => setTopTab(tab)}
                 className={`pb-1 cursor-default flex items-center gap-1.5 transition-colors relative ${
                    topTab === tab ? 'text-[#e0e0e0]' : 'text-[#808080] hover:text-[#d1d1d1]'
                 }`}
              >
                 {tab === 'Cluster' && <Database size={13} className={topTab === tab ? "text-[#4ade80]" : "text-green-800"} />}
                 {tab === 'Ultency Matching Engines' && <Zap size={13} className={topTab === tab ? "text-[#a78bfa]" : "text-purple-800"} />}
                 {tab === 'Hosted Access Servers' && <Server size={13} className={topTab === tab ? "text-[#4ade80]" : "text-green-800"} />}
                 {tab === 'Sponsored VPS' && <Cloud size={13} className={topTab === tab ? "text-[#60a5fa]" : "text-blue-800"} />}
                 {tab}
                 {topTab === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#007acc]"></div>}
              </div>
           ))}
        </div>
      </div>

      {/* Main Content Area based on bottom tab selection */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
         {bottomTab === 'Overview' && <NetworkOverviewMap />}
         {bottomTab === 'Nodes' && <NetworkNodesTable />}
         {bottomTab === 'CPU' && <NetworkGraphPanel title="CPU Performance" type="CPU" servers={serversList} />}
         {bottomTab === 'Memory' && <NetworkGraphPanel title="Memory Usage" type="Memory" servers={serversList} />}
         {/* Fallback for empty tabs */}
         {['Disk', 'Connections', 'Traffic', 'Latency', 'Network Packets', 'Trade'].includes(bottomTab) && (
            <div className="flex-1 flex items-center justify-center text-[#666666] text-sm">
               No data available for {bottomTab}
            </div>
         )}
      </div>

      {/* Bottom Tabs (Replacing AdminDataTable standard footer) */}
      <div className="h-7 bg-[#2b2b2b] border-t border-black/40 flex items-center px-1 overflow-x-auto no-scrollbar gap-0.5 shrink-0">
        {bottomTabs.map(tab => (
           <div 
              key={tab}
              onClick={() => setBottomTab(tab)}
              className={`h-[22px] px-3 text-[11px] flex items-center cursor-default transition-colors rounded-sm ${
                 bottomTab === tab 
                 ? 'bg-[#3e3e3e] text-white border border-black/40 shadow-sm' 
                 : 'text-[#999999] hover:text-[#cccccc] hover:bg-white/5 border border-transparent'
              }`}
           >
              {tab}
           </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkCluster;
