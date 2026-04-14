import React, { useState } from 'react';
import { Server, Zap, Cpu, MemoryStick as Memory, HardDrive, Share2, Activity, Clock, ShieldAlert, BarChart3, Database, Router, CheckCircle2, Lock, List, MapPin, Cloud } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

// Use the robust topojson host provided
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const networkNodesData = [
   { id: 5, type: 'Backup Server', server: 'MainTrade Backup Server', ipv4: '89.21.67.29', pubAddr: '89.21.67.29:440', basePri: '', curPri: '', cpu: '0%', threads: 42, memory: '20 739', sockets: 118, connect: '', trafficIn: '0', trafficOut: '0' },
   { id: 1, type: 'Main Trade Server', server: 'Main Trade Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:440', basePri: '', curPri: '', cpu: '0%', threads: 154, memory: '46 162', sockets: 156, connect: '23', trafficIn: '0', trafficOut: '0' },
   { id: 2, type: 'Access Server', server: 'Access Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:443', basePri: '0', curPri: '0', cpu: '2%', threads: 73, memory: '46 160', sockets: 156, connect: '13', trafficIn: '0', trafficOut: '0' },
   { id: 3, type: 'History Server', server: 'History Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:441', basePri: '', curPri: '', cpu: '0%', threads: 71, memory: '46 162', sockets: 159, connect: '10', trafficIn: '0', trafficOut: '0' },
   { id: 4, type: 'Backup Server', server: 'Local Main Status Server', ipv4: '86.104.251.172', pubAddr: '86.104.251.172:442', basePri: '', curPri: '', cpu: '1%', threads: 42, memory: '46 162', sockets: 157, connect: '', trafficIn: '0', trafficOut: '0' },
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
   <div className="flex-1 bg-[#222222] relative flex items-center justify-center p-0 overflow-hidden">
      <div className="w-full h-full flex flex-col items-center justify-center relative">
         <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 110 }}
            className="w-full h-full max-w-[1200px]"
            viewBox="0 0 800 500"
            style={{ width: "100%", height: "100%" }}
         >
            <ZoomableGroup center={[20, 20]} zoom={1.3}>
               <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                     geographies.map(geo => {
                        // Highlight USA and India based on standard country names
                        const name = geo.properties.name || '';
                        const isHighlight = name === "United States of America" || name === "India";

                        return (
                           <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={isHighlight ? "#2563eb" : "var(--bg-surface-3)"}
                              stroke="#3a3a3a"
                              strokeWidth={0.5}
                              style={{
                                 default: { outline: "none" },
                                 hover: { fill: isHighlight ? "#3b82f6" : "#5a5a5a", outline: "none" },
                                 pressed: { outline: "none" }
                              }}
                           />
                        );
                     })
                  }
               </Geographies>

               {/* London Node Cluster */}
               <Marker coordinates={[-0.1278, 51.5074]}>
                  <g transform="translate(-15, -15)">
                     <foreignObject width="120" height="100">
                        <div className="flex flex-col items-start pointer-events-auto cursor-pointer select-none">
                           <div className="flex gap-0.5 mb-1">
                              <div className="bg-[#4ade80] rounded-full w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-black border border-green-800 shadow-xl z-20">13</div>
                              <div className="bg-[#a3e635] rounded-full w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-black border border-green-800 shadow-xl z-10 -ml-1 mt-0.5">7</div>
                           </div>
                           <div className="flex gap-0.5 -mt-1 pl-[6px] z-30">
                              <div className="bg-[#ff9900] rounded-full w-[16px] h-[16px] flex items-center justify-center text-[8.5px] font-bold text-black border border-orange-800 shadow-xl">5</div>
                              <div className="bg-[#73c41d] rounded-full w-[16px] h-[16px] flex items-center justify-center text-[8.5px] font-bold text-white border border-green-900 shadow-xl -ml-1">3</div>
                           </div>
                           <div className="mt-[2px] bg-black/80 px-1 py-[1px] rounded text-[9px] text-white font-medium border border-white/20 shadow-lg backdrop-blur-sm -ml-1 whitespace-nowrap">28 ms</div>
                        </div>
                     </foreignObject>
                  </g>
               </Marker>
            </ZoomableGroup>
         </ComposableMap>
      </div>
   </div>
);



const NetworkNodesTable = () => (
   <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
      <div className="flex border-b border-black/40 bg-[color:var(--bg-surface-2)] sticky top-0 z-10 shadow-sm text-[11px] font-medium text-[color:var(--text-primary)]">
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
         <div className="flex-1 bg-[color:var(--bg-surface-2)]"></div>
      </div>
      {networkNodesData.map((node, idx) => (
         <div key={idx} className={`flex text-[11px] border-b border-black/10 cursor-default hover:bg-blue-600/20 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-40 px-3 py-1 border-r border-black/10 flex items-center gap-1.5 truncate">
               {renderIcon(node.type)}
               <span className="text-[color:var(--text-primary)]">{node.type}</span>
            </div>
            <div className="w-48 px-3 py-1 border-r border-black/10 text-[color:var(--text-primary)] truncate">{node.server}</div>
            <div className="w-32 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)]">{node.ipv4}</div>
            <div className="w-32 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)]">{node.ipv6}</div>
            <div className="w-40 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)]">{node.pubAddr}</div>
            <div className="w-12 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.id}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.basePri}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.curPri}</div>
            <div className="w-16 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.cpu}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.threads}</div>
            <div className="w-24 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.memory}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.sockets}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.connect}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.trafficIn}</div>
            <div className="w-20 px-3 py-1 border-r border-black/10 text-[color:var(--text-muted)] text-right">{node.trafficOut}</div>
            <div className="flex-1"></div>
         </div>
      ))}
      {[...Array(15)].map((_, i) => (
         <div key={i} className={`flex border-b border-black/5 opacity-40 ${(networkNodesData.length + i) % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-full h-[26px] border-r border-black/10"></div>
         </div>
      ))}
   </div>
);

const NetworkGraphPanel = ({ title, type, servers }) => {
   const generatePath = (points, max, colorType) => {
      let path = `M 0,${max}`;
      
      let memY = 0;
      if (colorType.includes('memory')) {
          if (colorType.includes('blue')) memY = max * (0.6 + Math.random() * 0.1);
          if (colorType.includes('orange')) memY = max * 0.05;
          if (colorType.includes('green')) memY = max * 0.15;
      } else if (colorType.includes('connection')) {
          if (colorType === 'connection-green') memY = max * (0.2 + Math.random() * 0.6);
          if (colorType === 'connection-blue') memY = max * 0.05;
      }

      for (let i = 0; i <= points; i++) {
         const x = (i / points) * 100;
         let val = 0;
         
         // Spike engine for CPU
         if (colorType === 'blue') {
            val = Math.random() > 0.85 ? max * (Math.random() * 0.9 + 0.1) : max * (Math.random() * 0.1);
         } else if (colorType === 'orange') {
            val = Math.random() > 0.95 ? max * (Math.random() * 0.1) : 0;
         } else if (colorType === 'green') {
            val = Math.random() > 0.92 ? max * (Math.random() * 0.2) : 0;
         } 
         // True Plateau & Drop Engine for Connections (Squares Waves)
         else if (colorType.includes('connection')) {
            if (colorType === 'connection-green') {
                // 2.5% chance to massively jump to a new plateau layer
                if (Math.random() > 0.975) memY = max * (0.1 + Math.random() * 0.8);
                // high-frequency jitter on top of plateau
                let jitter = (Math.random() - 0.5) * max * 0.08;
                val = Math.max(0, Math.min(max, memY + jitter));
            } else {
                // stable flatline bottom for connections
                if (Math.random() > 0.99) memY = max * (0.02 + Math.random() * 0.06);
                let jitter = (Math.random() - 0.5) * max * 0.01;
                val = Math.max(0, Math.min(max, memY + jitter));
            }
         }
         // Flat stepped engine for Memory/Disk
         else if (colorType.includes('memory')) {
            if (Math.random() > 0.97) {
               memY += (Math.random() - 0.5) * max * (colorType.includes('blue') ? 0.08 : 0.03);
            }
            val = memY;
         }
         
         path += ` L ${x},${Math.max(0, max - val)}`;
      }
      return path;
   };

   return (
      <div className="flex-1 bg-[#121212] overflow-auto no-scrollbar flex flex-col pt-[1px]">
         {servers.map((srv, idx) => (
            <div key={idx} className="h-[200px] bg-[color:var(--bg-app)] border-b-[1.5px] border-[#000000] relative shrink-0">
               {/* Server Title Header */}
               <div className="absolute top-1 left-2 text-[11px] text-[color:var(--text-primary)] flex items-center gap-1.5 z-20">
                  {renderIcon(srv.type)} <span className="font-semibold tracking-wide whitespace-nowrap">{srv.name}</span>
               </div>

               {/* Legend & Stat Blocks Overlay */}
               {type === 'CPU' ? (
                  <div className="absolute top-[26px] left-[10px] flex gap-[9px] z-20 select-none bg-[color:var(--bg-app)]/40 p-1 rounded backdrop-blur-[1px]">
                     <div className="text-[10px] font-sans leading-[15px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#2563eb]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">CPU total: <span className="text-white">1%, 8 cores</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[color:var(--text-muted)]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">CPU process: <span className="text-white">0%</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#f59e0b]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">CPU DPC: <span className="text-white">0</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#4ade80]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">CPU interrupts: <span className="text-white">0</span></span></div>
                     </div>
                     {/* Floating Context/Tooltip block next to legend */}
                     <div className="flex flex-col text-[10px] font-mono leading-[15px] opacity-100 bg-[color:var(--text-primary)] w-[18px] items-center mt-[-1px] shadow-2xl border border-[#aaa]">
                        <div className="bg-[#b3c7f9] text-[#000] w-full text-center border-b border-white font-bold">{Math.floor(Math.random() * 6 + 3)}</div>
                        <div className="bg-[color:var(--text-primary)] text-[#000] w-full text-center border-b border-white font-bold">0</div>
                        <div className="bg-[#fcd34d] text-[#000] w-full text-center border-b border-white font-bold">{Math.floor(Math.random() * 2)}</div>
                        <div className="bg-[color:var(--text-primary)] text-[#000] w-full text-center font-bold">0</div>
                     </div>
                  </div>
               ) : type === 'Connections' ? (
                  <div className="absolute top-[26px] left-[6px] z-20 select-none">
                     <div className="text-[10px] font-sans leading-[14px]">
                        <div><span className="text-[#2563eb] font-bold mr-1">-</span><span className="text-[color:var(--text-muted)] tracking-tight">Connections: <span className="text-white">{Math.floor(Math.random() * 15 + 5)}</span></span></div>
                        <div><span className="text-[#4ade80] font-bold mr-1">-</span><span className="text-[color:var(--text-muted)] tracking-tight">Sockets: <span className="text-white">{Math.floor(Math.random() * 80 + 40)}</span></span></div>
                     </div>
                  </div>
               ) : (
                  <div className="absolute top-[26px] left-[10px] flex gap-[9px] z-20 select-none bg-[color:var(--bg-app)]/40 p-1 rounded backdrop-blur-[1px]">
                     <div className="text-[10px] font-sans leading-[15px] flex flex-col shadow-sm">
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#2563eb]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">{type === 'Disk' ? 'Disk Read:' : 'Allocated:'} <span className="text-white">{srv.memory} MB{type === 'Disk' ? '/s' : ''}, {Math.floor(Math.random() * 10 + 60)}%</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[color:var(--text-muted)]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">{type === 'Disk' ? 'Disk Write:' : 'System:'} <span className="text-white">{Math.floor(Math.random() * 5 + 5)}%</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#f59e0b]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">{type === 'Disk' ? 'Active Time:' : 'Cache:'} <span className="text-white">{type === 'Disk' ? '12%' : 'Active'}</span></span></div>
                        <div className="flex items-center gap-1.5"><div className="w-[7px] h-[3px] bg-[#4ade80]"></div><span className="text-[color:var(--text-muted)] font-medium drop-shadow-md">{type === 'Disk' ? 'Queue Length:' : 'Page Faults:'} <span className="text-white">0</span></span></div>
                     </div>
                     {/* Floating Context/Tooltip block next to legend */}
                     <div className="flex flex-col text-[10px] font-mono leading-[15px] opacity-100 bg-[color:var(--text-primary)] w-[18px] items-center mt-[-1px] shadow-2xl border border-[#aaa]">
                        <div className="bg-[#b3c7f9] text-[#000] w-full text-center border-b border-white font-bold">{Math.floor(Math.random() * 10 + 60)}</div>
                        <div className="bg-[color:var(--text-primary)] text-[#000] w-full text-center border-b border-white font-bold">{Math.floor(Math.random() * 5 + 5)}</div>
                        <div className="bg-[#fcd34d] text-[#000] w-full text-center border-b border-white font-bold">1</div>
                        <div className="bg-[color:var(--text-primary)] text-[#000] w-full text-center font-bold">0</div>
                     </div>
                  </div>
               )}

               {/* Absolute edge-to-edge SVG canvas */}
               <div className="absolute inset-x-0 bottom-0 top-0 z-0 pr-[24px] pl-0 pointer-events-none">
                  <svg className="w-full h-full border-r border-[#444] opacity-90" viewBox="0 0 100 100" preserveAspectRatio="none">
                     {/* Horizontal grid lines mapped */}
                     {(type === 'Connections' ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.2, 0.4, 0.6, 0.8, 1]).map((pct, i) => (
                        <line key={`h-${i}`} x1="0" y1={(1 - pct) * 100} x2="100" y2={(1 - pct) * 100} stroke="#333" strokeOpacity={type === 'Connections' ? "0.3" : "1"} strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
                     ))}

                     {/* Base Flat Baseline */}
                     <path d="M 0,100 L 100,100" fill="none" stroke="var(--bg-surface-1)" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                     
                     {/* Sub-Metric Graphs */}
                     <path d={generatePath(type === 'CPU' ? 500 : (type === 'Connections' ? 400 : 100), 100, type === 'CPU' ? 'green' : (type === 'Connections' ? 'connection-green' : 'memory-green'))} fill="none" stroke="#4ade80" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                     {type !== 'Connections' && <path d={generatePath(type === 'CPU' ? 500 : 100, 100, type === 'CPU' ? 'orange' : 'memory-orange')} fill="none" stroke="#f59e0b" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />}
                     {/* Primary Main Metric (Blue) */}
                     <path d={generatePath(type === 'CPU' ? 500 : (type === 'Connections' ? 400 : 100), 100, type === 'CPU' ? 'blue' : (type === 'Connections' ? 'connection-blue' : 'memory-blue'))} fill="none" stroke="#3b82f6" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                  </svg>
               </div>

               {/* Y-Axis Labeling Right Side */}
               {type !== 'Connections' && (
                  <div className="absolute right-[5px] top-[2px] text-[9.5px] text-[color:var(--text-muted)]">
                     %
                  </div>
               )}
               <div className="absolute right-[5px] top-0 bottom-0 flex flex-col justify-between py-1 text-[9.5px] text-[color:var(--text-muted)] text-right pointer-events-none mt-4 z-10 w-[14px]">
                  {type === 'Connections' ? (
                     <>
                        <span>200</span>
                        <span>150</span>
                        <span>100</span>
                        <span>50</span>
                        <span className="mb-[1px]">0</span>
                     </>
                  ) : (
                     <>
                        <span>100</span>
                        <span>80</span>
                        <span>60</span>
                        <span>40</span>
                        <span>20</span>
                        <span className="mb-[1px]">0</span>
                     </>
                  )}
               </div>

               {/* Bottom Full Spread Ticks */}
               <div className="absolute left-0 bottom-0 h-1 w-full flex flex-row overflow-hidden pr-6 z-10 pointer-events-none border-t border-[#333]">
                  {[...Array(150)].map((_, i) => (
                     <div key={`tick-${i}`} className={`flex-1 ${i % 10 === 0 ? 'h-full border-l border-[#888]' : 'h-1/2 border-l border-[#555]'}`}></div>
                  ))}
               </div>

               {/* X-Axis Final Node Timeline */}
               {idx === servers.length - 1 && (
                  <div className="absolute left-0 -bottom-4 h-4 text-[9px] text-[#888] flex items-center justify-between w-[calc(100%-24px)] pointer-events-none px-1 z-20">
                     <span>2026.03.30</span>
                     <span>2026.03.31 02:00</span>
                     <span>06:00</span>
                     <span>10:00</span>
                     <span>14:00</span>
                     <span>18:00</span>
                     <span>22:00</span>
                     <span>02:00</span>
                     <span>06:00</span>
                     <span>10:00</span>
                     <span>14:00</span>
                  </div>
               )}
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
      { type: 'Backup Server', name: 'Local Main Status Server', memory: '46 162' },
   ];

   return (
      <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative">
         {/* Header section */}
         <div className={`px-4 pt-4 pb-0 bg-[color:var(--bg-app)] ${bottomTab === 'Nodes' ? 'border-b border-black/40 bg-[color:var(--bg-surface-1)]' : 'border-b border-white/5'}`}>
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
                     Network Cluster: <span className="text-[color:var(--text-muted)] font-normal text-sm">23 online</span>
                  </h2>
                  {bottomTab === 'Nodes' && (
                     <p className="text-[color:var(--text-muted)] text-[12px] mt-0.5">Monitor the platform infrastructure, manage network settings, and scale the cluster for load balancing</p>
                  )}
               </div>
               <div className="flex gap-2">
                  <button className="px-3 py-1 bg-transparent border border-[color:var(--border-strong)] rounded-sm text-[12px] text-[color:var(--text-primary)] hover:bg-white/5 transition-colors">
                     Add Server
                  </button>
                  {bottomTab === 'Nodes' && (
                     <button className="px-2 py-1 bg-transparent text-[color:var(--accent-500)] hover:bg-white/5 transition-colors ml-2">
                        <Router size={16} />
                     </button>
                  )}
                  {bottomTab === 'Nodes' && (
                     <button className="px-2 py-1 bg-transparent text-[color:var(--accent-500)] hover:bg-white/5 transition-colors">
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
                     className={`pb-1 cursor-default flex items-center gap-1.5 transition-colors relative ${topTab === tab ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
                        }`}
                  >
                     {tab === 'Cluster' && <Database size={13} className={topTab === tab ? "text-[#4ade80]" : "text-green-800"} />}
                     {tab === 'Ultency Matching Engines' && <Zap size={13} className={topTab === tab ? "text-[#a78bfa]" : "text-purple-800"} />}
                     {tab === 'Hosted Access Servers' && <Server size={13} className={topTab === tab ? "text-[#4ade80]" : "text-green-800"} />}
                     {tab === 'Sponsored VPS' && <Cloud size={13} className={topTab === tab ? "text-[#60a5fa]" : "text-blue-800"} />}
                     {tab}
                     {topTab === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[color:var(--accent-500)]"></div>}
                  </div>
               ))}
            </div>
         </div>

         {/* Main Content Area based on bottom tab selection */}
         <div className="flex-1 flex flex-col overflow-hidden bg-[color:var(--bg-app)]">
            {bottomTab === 'Overview' && <NetworkOverviewMap />}
            {bottomTab === 'Nodes' && <NetworkNodesTable />}
            {bottomTab === 'CPU' && <NetworkGraphPanel title="CPU Performance" type="CPU" servers={serversList} />}
            {bottomTab === 'Memory' && <NetworkGraphPanel title="Memory Usage" type="Memory" servers={serversList} />}
            {bottomTab === 'Disk' && <NetworkGraphPanel title="Disk Activity" type="Disk" servers={serversList} />}
            {bottomTab === 'Connections' && <NetworkGraphPanel title="Connections" type="Connections" servers={serversList} />}
            {/* Fallback for empty tabs */}
            {['Traffic', 'Latency', 'Network Packets', 'Trade'].includes(bottomTab) && (
               <div className="flex-1 flex items-center justify-center text-[color:var(--text-muted)] text-sm">
                  No data available for {bottomTab}
               </div>
            )}
         </div>

         {/* Bottom Tabs (Replacing AdminDataTable standard footer) */}
         <div className="h-7 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center px-1 overflow-x-auto no-scrollbar gap-0.5 shrink-0">
            {bottomTabs.map(tab => (
               <div
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`h-[22px] px-3 text-[11px] flex items-center cursor-default transition-colors rounded-sm ${bottomTab === tab
                        ? 'bg-[#3e3e3e] text-white border border-black/40 shadow-sm'
                        : 'text-[#999999] hover:text-[color:var(--text-secondary)] hover:bg-white/5 border border-transparent'
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
