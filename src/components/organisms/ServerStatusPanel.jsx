import React, { useState } from 'react';
import { Settings, RefreshCw, ChevronDown, ChevronRight, Cpu, HardDrive, Globe, Monitor } from 'lucide-react';
import { deterministicRatio } from '../../lib/deterministicChart';

const normalizeSemanticColor = (color) => {
   const normalized = typeof color === 'string' ? color.toLowerCase() : color;
   if (normalized === '#4ade80' || normalized === '#22c55e' || normalized === '#4ec9b0') {
      return 'var(--success-500)';
   }
   if (normalized === '#ef4444' || normalized === '#f48771' || normalized === '#f87171') {
      return 'var(--danger-500)';
   }
   return color;
};

// Sub-component tailored specifically to replicate the 8 dense miniature graphs via localized svg mathematical maps
const OverviewMiniGraph = ({ type }) => {
    const configs = {
       'CPU': {
           labels: [
               { c: '#3b82f6', t: 'CPU total: 4%, 8 cores', v: '3', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'CPU process: 0%', v: '0', bg: 'var(--text-primary)' },
               { c: '#f59e0b', t: 'CPU DPC: 0', v: '0', bg: '#fcd34d' },
               { c: '#06b6d4', t: 'CPU interrupts: 0', v: '0', bg: 'var(--text-primary)' }
           ],
           unit: '%',
           lines: [{ s: 'spike-blue', c: '#3b82f6' }, { s: 'flat', c: '#4ade80' }, { s: 'flat', c: '#f59e0b' }, { s: 'flat', c: '#06b6d4' }]
       },
       'Traffic': {
           labels: [
               { c: '#3b82f6', t: 'Traffic in: 892 Kbps', v: '728 Kbps', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'Traffic out: 409 Kbps', v: '330 Kbps', bg: '#bbf7d0' }
           ],
           unit: 'Mbps',
           lines: [{ s: 'traffic-green', c: '#4ade80' }, { s: 'traffic-blue', c: '#3b82f6' }]
       },
       'Packets': {
           labels: [
               { c: '#3b82f6', t: 'Packets: 64 492', v: '229 835', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'Retransmits: 28, 0.04%', v: '123\n0.05%', isMulti: true, bg: 'var(--text-primary)' }
           ],
           lines: [{ s: 'flat', c: '#4ade80' }, { s: 'steady-blue', c: '#3b82f6' }]
       },
       'ReadWrite': {
           labels: [
               { c: '#3b82f6', t: 'Read: 0 MB', v: '0 MB', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'Write: 0 MB', v: '0 MB', bg: 'var(--text-primary)' }
           ],
           unit: 'MB',
           lines: [{ s: 'flat', c: '#4ade80' }, { s: 'sawtooth-blue', c: '#3b82f6' }]
       },
       'Deals': {
           labels: [
               { c: '#3b82f6', t: 'Deals: 0', v: '0', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'Requests: 0', v: '7', bg: 'var(--text-primary)' }
           ],
           lines: [{ s: 'flat', c: '#3b82f6' }, { s: 'erratic-green', c: '#4ade80' }]
       },
       'Memory': {
           labels: [
               { c: '#3b82f6', t: 'Free memory: 46 059 MB, 70.39%', isMultiHover: ['46 053 MB', '70.38%'] }
           ],
           unit: 'MB, %',
           lines: [{ s: 'high-flat', c: '#3b82f6' }]
       },
       'Handles': {
           labels: [
               { c: '#3b82f6', t: 'Handles total: 115 662', v: '115 411', bg: '#b3c7f9' },
               { c: '#4ade80', t: 'Handles process: 2 960', v: '2 936', bg: 'var(--text-primary)' }
           ],
           lines: [{ s: 'low-flat', c: '#3b82f6' }, { s: 'flat', c: '#4ade80' }]
       },
       'Disk': {
           labels: [
               { c: '#3b82f6', t: 'Free disk space: 460 639 MB, 60.06% of 748 GB', isMultiHover: ['460 680 MB', '60.06%'] }
           ],
           unit: 'MB, %',
           lines: [{ s: 'high-flat', c: '#3b82f6' }]
       }
    };

    const cfg = configs[type];

    const genPath = (style) => {
       const max = 100, pts = 600;
       let path = `M 0,${max}`, memY = max * 0.2;
       const ratio = (index, label) => deterministicRatio('overview', type, style, index, label);
       
       for (let i = 0; i <= pts; i++) {
          let val = 0;
          if (style === 'spike-blue') val = ratio(i, 'spike') > 0.98 ? max * (0.2 + ratio(i, 'spike-height') * 0.7) : max * 0.02;
          else if (style === 'flat') val = 0.5;
          else if (style === 'traffic-blue') { val = max * 0.15 + (ratio(i, 'traffic-blue') * max * 0.1); if (i > pts * 0.65 && i < pts * 0.66) val = max * 0.8; }
          else if (style === 'traffic-green') { val = max * 0.05 + (ratio(i, 'traffic-green') * max * 0.05); if (i > pts * 0.65 && i < pts * 0.66) val = max * 0.95; }
          else if (style === 'sawtooth-blue') val = (i % 40 < 4) ? max * 0.9 : 0;
          else if (style === 'erratic-green') val = max * 0.3 + (ratio(i, 'erratic') * max * 0.5);
          else if (style === 'steady-blue') {
              if (ratio(i, 'steady-step') > 0.95) memY += (ratio(i, 'steady-delta') - 0.5) * max * 0.15;
              memY = Math.max(max * 0.1, Math.min(max * 0.9, memY));
              val = memY + ratio(i, 'steady-jitter') * max * 0.05;
          }
          else if (style === 'high-flat') val = max * 0.6 + (ratio(i, 'high-flat') * max * 0.01);
          else if (style === 'low-flat') val = max * 0.1 + (ratio(i, 'low-flat') * max * 0.01);

          path += ` L ${(i / pts) * 100},${max - val}`;
       }
       return path;
    };

    return (
       <div className="relative bg-[color:var(--bg-app)] flex flex-col overflow-hidden group">
          {/* Top Edge Labels */}
          <div className="absolute top-[6px] left-[8px] z-20 flex flex-col text-[10.5px] whitespace-nowrap pointer-events-none tracking-tight">
             {cfg.labels.map((l, i) => (
                <div key={i} className="flex">
                   <div style={{color: normalizeSemanticColor(l.c)}} className="font-bold mr-1.5">-</div>
                   <div className="text-[color:var(--text-muted)] drop-shadow-md">{l.t}</div>
                </div>
             ))}
          </div>
          {cfg.unit && <div className="absolute top-[6px] right-[8px] z-20 text-[10.5px] text-[color:var(--text-muted)] font-sans">{cfg.unit}</div>}

          {/* Core Paths Container */}
          <div className="flex-1 relative mt-[14px]">
             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map(pct => (
                   <line key={pct} x1="0" y1={pct*100} x2="100" y2={pct*100} stroke="#333" strokeOpacity="0.8" strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
                ))}
                <path d="M 0,100 L 100,100" fill="none" stroke="#444" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                
                {cfg.lines.map((line, i) => (
                   <path key={i} d={genPath(line.s)} fill="none" stroke={normalizeSemanticColor(line.c)} strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
                ))}
             </svg>
          </div>

          {/* Dense Lower Tick Border Array */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] border-t border-[#444] flex justify-between px-1">
              {[...Array(90)].map((_, i) => (
                 <div key={i} className={`w-[1px] bg-[#555] ${i % 10 === 0 ? 'h-[3px]' : 'h-[1.5px]'}`}></div>
              ))}
          </div>
       </div>
    );
};

const DeviceRow = ({ indent = 0, expanded = false, expandable = false, icon: Icon, iconColor='text-[#60a5fa]', text, statBar }) => {
    return (
       <div className="flex flex-col">
          <div className="flex items-center gap-1.5 px-1 py-[3px] border-b border-[color:var(--bg-surface-1)] hover:bg-[color:var(--bg-surface-1)] cursor-pointer select-none">
             {/* Indent spacer */}
             <div style={{width: `${indent * 14}px`}} className="shrink-0" />
             
             {/* Expander Icon */}
             <div className="w-[12px] flex items-center justify-center shrink-0">
                {expandable && (
                   expanded ? <ChevronDown size={14} className="text-[color:var(--text-muted)]" /> : <ChevronRight size={14} className="text-[color:var(--text-muted)]" />
                )}
             </div>
             
             {/* Node Icon */}
             {Icon && <Icon size={12} className={`${iconColor} shrink-0`} />}
             
             {/* Main Text */}
             <div className="text-[11.5px] text-[color:var(--text-primary)] flex-1 whitespace-nowrap">
                {text}
             </div>
             
             {/* Detailed Stat Bars Right-Aligned */}
             {statBar && (
                <div className="flex items-center gap-2 shrink-0 pr-6 mr-8">
                   {statBar.type === 'disk' ? (
                       <div className="flex gap-[18px]">
                           <div className="flex items-center gap-3">
                              <div className="w-[60px] flex items-center">
                                 <div className="h-[3px] bg-[#ef4444] w-[30%]"/><div className="h-[3px] bg-[#22c55e] w-[70%] relative"><div className="absolute h-[7px] w-[2px] bg-[#4ade80] top-[-2px] shadow-[0_0_3px_#4ade80] left-[5px]"/></div>
                              </div>
                              <span className="text-[11px] text-[color:var(--text-muted)] w-[45px] text-left">read: 543</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="w-[60px] flex items-center">
                                 <div className="h-[3px] bg-[#ef4444] w-[30%]"/><div className="h-[3px] bg-[#22c55e] w-[70%] relative"><div className="absolute h-[7px] w-[2px] bg-[#4ade80] top-[-2px] shadow-[0_0_3px_#4ade80] left-[20px]"/></div>
                              </div>
                              <span className="text-[11px] text-[color:var(--text-muted)] w-[30px]">write:</span>
                              <span className="text-[11.5px] text-white w-[50px] text-right">268 MB/s</span>
                           </div>
                       </div>
                   ) : (
                       <div className="flex items-center gap-3 w-[260px] justify-end">
                          <div className="w-[60px] flex items-center">
                             <div className="h-[3px] bg-[#ef4444] w-[30%]"/><div className="h-[3px] bg-[#22c55e] w-[70%] relative"><div className="absolute h-[7px] w-[2px] bg-[#4ade80] top-[-2px] shadow-[0_0_3px_#4ade80] left-[40%]"/></div>
                          </div>
                          <span className="text-[11px] text-[color:var(--text-muted)] w-[60px] text-right">{statBar.label}</span>
                          <span className="text-[11.5px] text-white w-[60px] text-right">{statBar.val}</span>
                       </div>
                   )}
                </div>
             )}
          </div>
       </div>
    )
 }
 

const StackedGraphRow = ({ isLast, isShort, cfg }) => {
    const genPath = (style) => {
       const max = 100, pts = 600;
       let path = `M 0,${max}`;
       const ratio = (index, label) => deterministicRatio('stacked', cfg.labels?.[0]?.t || '', style, index, label);
       
       for (let i = 0; i <= pts; i++) {
          let val = 0;
          if (style === 'spike-blue') val = ratio(i, 'spike') > 0.96 ? max * (0.2 + ratio(i, 'spike-height') * 0.7) : max * 0.02;
          else if (style === 'flat-bottom') val = 0.5;
          else if (style === 'flat-zero') val = 1;
          else if (style === 'threads-blue') val = max * 0.75 + (ratio(i, 'thread-spike') > 0.95 ? max * 0.04 : ratio(i, 'thread-jitter') * max * 0.01);
          else if (style === 'handles-blue') val = max * 0.75 + ratio(i, 'handles') * max * 0.02;
          else if (style === 'memory-free') val = max * 0.70 + ratio(i, 'memory-free') * max * 0.01;
          else if (style === 'memory-process') val = max * 0.80 + (i > 450 ? max * 0.05 : 0) + ratio(i, 'memory-process') * max * 0.005;
          else if (style === 'page-faults') val = ratio(i, 'fault') > 0.985 ? max * (0.4 + ratio(i, 'fault-height') * 0.5) : 0;
          else if (style === 'iops-blue') val = max * 0.2 + ratio(i, 'iops') * max * 0.15 + (ratio(i, 'iops-spike') > 0.95 ? max * 0.4 : 0);
          else if (style === 'latency-blue') val = (i % 30 < 2 && ratio(i, 'latency') > 0.3) ? max * ratio(i, 'latency-height') * 0.8 : max * 0.02;
          else if (style === 'sawtooth-blue') val = (i % 26 < 2) ? max * 0.4 : 0;

          path += ` L ${(i / pts) * 100},${max - val}`;
       }
       return path;
    };

    return (
       <div className={`relative bg-[color:var(--bg-app)] flex flex-col group border-b border-[#333] ${isShort ? 'h-[120px] shrink-0' : 'flex-1'}`}>
          {/* Legend Labels */}
          <div className="absolute top-[6px] left-[8px] z-20 flex flex-col text-[10.5px] whitespace-nowrap pointer-events-none tracking-tight">
             {cfg.labels.map((l, i) => (
                <div key={i} className="flex">
                   <div style={{color: normalizeSemanticColor(l.c)}} className="font-bold mr-1.5">-</div>
                   <div className="text-[color:var(--text-muted)] drop-shadow-md">{l.t}</div>
                </div>
             ))}
          </div>

          {/* Unit / Y-Axis Text Grid */}
          <div className={`absolute top-0 right-0 w-[45px] z-20 border-l border-[#333] pointer-events-none select-none bg-[color:var(--bg-app)] ${isLast ? 'bottom-[16px]' : 'bottom-[4px]'}`}>
             {cfg.unit && <div className="text-[10px] text-[color:var(--text-muted)] font-sans absolute right-[50px] top-[4px] whitespace-nowrap">{cfg.unit}</div>}
             {cfg.yAxis.map((yVal, idx) => (
                 <div key={idx} className="text-[9.5px] text-[color:var(--text-muted)] pr-1.5 leading-none absolute right-0 font-sans tracking-tight" 
                      style={{
                          top: `${(idx / (cfg.yAxis.length - 1)) * 100}%`, 
                          transform: idx === 0 ? 'translateY(4px)' : idx === cfg.yAxis.length - 1 ? 'translateY(-12px)' : 'translateY(-50%)'
                      }}>
                    {yVal}
                 </div>
             ))}
          </div>

          {/* Core Paths Container */}
          <div className={`absolute top-0 left-0 right-[45px] ${isLast ? 'bottom-[16px]' : 'bottom-[4px]'}`}>
             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {cfg.yAxis.map((_, idx) => (
                   <line key={idx} x1="0" y1={(idx / (cfg.yAxis.length - 1)) * 100} x2="100" y2={(idx / (cfg.yAxis.length - 1)) * 100} stroke="#333" strokeOpacity="0.8" strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
                ))}
                
                {cfg.lines.map((line, i) => (
                   <path key={i} d={genPath(line.s)} fill="none" stroke={normalizeSemanticColor(line.c)} strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
                ))}
             </svg>
          </div>

          {/* Ticks & Timestamps Row */}
          <div className={`absolute bottom-0 left-0 right-[45px] ${isLast ? 'h-[16px]' : 'h-[4px]'} border-t border-[#444] flex items-start overflow-hidden`}>
             <div className="w-full flex justify-between">
                {[...Array(120)].map((_, i) => (
                    <div key={i} className={`w-[1px] bg-[#666] ${i % 12 === 0 ? 'h-[4px]' : 'h-[2px]'}`}></div>
                ))}
             </div>
             {isLast && (
                 <div className="absolute top-[4px] left-[5px] right-[5px] flex justify-between text-[9px] text-[color:var(--text-muted)] font-sans tracking-tight">
                     <span>2026.03.30</span><span>02:00</span><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span><span>22:00</span>
                     <span>02:00</span><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span><span>22:00</span><span>02:00</span><span>06:00</span><span>10:00</span>
                 </div>
             )}
          </div>
       </div>
    );
};

// New Threads specific diagnostic table mimicking server execution thread pools
const ThreadsTab = () => {
   const threadsData = [
      { type: 'green', name: 'sessions pool', p: '', v1: '2 469 799 741 342', v2: '283 357 833', v3: '8 / 8', v4: '64 / 2560' },
      { type: 'green', name: 'trade groups real pool', p: '', v1: '5 185 075 924 228', v2: '290 919 175', v3: '8 / 9', v4: '1924 / 2560' },
      { type: 'green', name: 'pool context', p: '', v1: '179 038', v2: '2', v3: '8 / 9', v4: '64 / 2048' },
      { type: 'green', name: 'trade request process', p: '', v1: '546 901 030 134', v2: '1 141 919', v3: '8 / 8', v4: '64 / 2048' },
      { type: 'blue', name: 'system thread pool', p: '', v1: '3 189 681 274', v2: '1 942', v3: '8 / 8', v4: '116 / 1024' },
      { type: 'green', name: 'session requests pool', p: '', v1: '21 704 766 268', v2: '1 447 272', v3: '8 / 8', v4: '64 / 2048' },
      { type: 'green', name: 'ioport pool', p: '', v1: '160 806', v2: '2', v3: '8 / 9', v4: '64 / 2048' },
      { type: 'blue', name: 'system thread pool', p: '0.39%', v1: '3 561 647 574', v2: '2 849', v3: '8 / 8', v4: '116 / 1024' },
      { type: 'green', name: 'sessions execute pool', p: '', v1: '150 942', v2: '3', v3: '8 / 9', v4: '64 / 2560' },
      { type: 'green', name: 'server port pool', p: '', v1: '155 285 015 062', v2: '12 251 435', v3: '8 / 10', v4: '64 / 2048' },
      { type: 'green', name: 'session requests pool', p: '', v1: '22 214 211 788', v2: '1 448 491', v3: '8 / 8', v4: '64 / 2048' },
      { type: 'green', name: 'trade groups demo pool', p: '', v1: '4 610 696 760 102', v2: '295 452 729', v3: '8 / 9', v4: '64 / 2560' },
      { type: 'green', name: 'ioport dispatcher', p: '', v1: '41 626 465 786', v2: '1 543 909', v3: '8 / 8', v4: '64 / 2048' },
      { type: 'green', name: 'trade groups real pool', p: '', v1: '5 628 717 784 842', v2: '296 021 863', v3: '8 / 9', v4: '1928 / 2560' },
      { type: 'green', name: 'sessions pool', p: '', v1: '2 309 592 524 798', v2: '284 095 635', v3: '8 / 8', v4: '64 / 2560' },
   ];

   const IconBox = ({ type }) => (
       <div className={`w-[13px] h-[11px] rounded-[1px] border flex flex-col overflow-hidden shrink-0 ${type === 'green' ? 'border-[#22c55e] bg-[#0f2e1b]' : 'border-[#3b82f6] bg-[#0f2240]'}`}>
           <div className={`h-[3px] w-full ${type === 'green' ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'}`}></div>
       </div>
   );

   return (
       <div className="flex-1 overflow-auto bg-[color:var(--bg-app)] border-t border-[#333] no-scrollbar">
           <div className="flex flex-col min-w-[800px] pb-[40px]">
               {threadsData.map((row, i) => (
                   <div key={i} className={`flex items-center text-[11px] hover:bg-[#2a2d3e] border-b border-[color:var(--bg-surface-1)] py-[3px] px-1 cursor-pointer ${i%2===0 ? 'bg-[color:var(--bg-app)]' : 'bg-[#222]'} transition-colors`}>
                       <div className="w-[280px] flex items-center gap-1.5 shrink-0 border-r border-[#333] px-1">
                           <IconBox type={row.type} />
                           <span className="text-[color:var(--text-primary)] font-sans tracking-tight">{row.name}</span>
                       </div>
                       <div className="w-[60px] text-right text-[color:var(--text-primary)] shrink-0 border-r border-[#333] pr-2">{row.p}</div>
                       <div className="flex-1 text-right text-[color:var(--text-primary)] shrink-0 border-r border-[#333] pr-2">{row.v1}</div>
                       <div className="w-[120px] text-right text-[color:var(--text-primary)] shrink-0 border-r border-[#333] pr-2">{row.v2}</div>
                       <div className="w-[100px] text-right text-[color:var(--text-primary)] shrink-0 border-r border-[#333] pr-2">{row.v3}</div>
                       <div className="w-[100px] text-right text-[color:var(--text-primary)] shrink-0 pr-2">{row.v4}</div>
                   </div>
               ))}
               {[...Array(30)].map((_, i) => (
                   <div key={`fill-${i}`} className={`flex border-b border-[color:var(--bg-surface-1)] h-[21px] ${ (i+threadsData.length)%2===0 ? 'bg-[color:var(--bg-app)]' : 'bg-[#222]'}`}>
                       <div className="w-[280px] border-r border-[#333]"></div>
                       <div className="w-[60px] border-r border-[#333]"></div>
                       <div className="flex-1 border-r border-[#333]"></div>
                       <div className="w-[120px] border-r border-[#333]"></div>
                       <div className="w-[100px] border-r border-[#333]"></div>
                       <div className="w-[100px]"></div>
                   </div>
               ))}
           </div>
       </div>
   );
}

// Windows Firewall tab enforcing exact MT5 port rendering rules
const FirewallTab = () => {
    const fwData = [
       { n: '@{Microsoft.AAD.BrokerPlugin_1000...', pr: 'domain, private', act: 'allow', addr: '*', port: 'Any', proto: 'Any', inf: 'All', app: '' },
       { n: '@{Microsoft.Win32WebViewHost_10...', pr: 'all', act: 'allow', addr: '*', port: 'Any', proto: 'Any', inf: 'All', app: '' },
       { n: '@{Microsoft.Windows.CloudExperience...', pr: 'domain, private', act: 'allow', addr: '*', port: 'Any', proto: 'Any', inf: 'All', app: '' },
       { n: '@{Microsoft.Windows.Search_1.15.0...', pr: 'domain, private', act: 'allow', addr: '*', port: 'Any', proto: 'Any', inf: 'All', app: '' },
       { n: '@{Microsoft.Windows.SecHealthUI_...', pr: 'domain, private', act: 'allow', addr: '*', port: 'Any', proto: 'Any', inf: 'All', app: '' },
       { n: 'AllJoyn Router (TCP-In)', pr: 'domain, private', act: 'allow', addr: '', port: '9955', proto: 'TCP', inf: 'All', app: 'c:\\windows\\system32\\svchost.exe' },
       { n: 'Cast to Device streaming server (HT...', pr: 'private', act: 'allow', addr: 'LocalSubnet', port: '10246', proto: 'TCP', inf: 'All', app: 'system' },
       { n: 'Centroid_Allow_Checkmk_Monitoring', pr: 'all', act: 'allow', addr: '3.11.129.113', port: '6556', proto: 'TCP', inf: 'All', app: '' },
       { n: 'Core Networking - Destination Unreach...', pr: 'all', act: 'allow', addr: '', port: '', proto: 'ICMPv6', inf: 'All', app: 'system' },
       { n: 'Cast to Device streaming server (RTSP...', pr: 'private', act: 'allow', addr: 'LocalSubnet', port: '23554, 23555, 23556', proto: 'TCP', inf: 'All', app: 'c:\\windows\\system32\\mdeserver.exe' },
       { n: 'Cast to Device UPnP Events (TCP-In)', pr: 'public', act: 'allow', addr: '', port: '2869', proto: 'TCP', inf: 'All', app: 'system' },
       { n: 'Centroid_Allow_WinRM_HTTPS', pr: 'all', act: 'allow', addr: '3.11.129.113, 18.132.165.131', port: '11111', proto: 'TCP', inf: 'All', app: '' },
       { n: 'Core Networking - Dynamic Host Config...', pr: 'all', act: 'allow', addr: '', port: '68', proto: 'UDP', inf: 'All', app: 'c:\\windows\\system32\\svchost.exe' },
    ];

    const CheckIcon = () => (
        <div className="w-[10px] h-[10px] bg-[#2a59a3] border border-[#60a5fa] rounded-[1px] flex items-center justify-center shrink-0">
           <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] border-t border-[#333] overflow-hidden">
            <div className="flex bg-[#333] border-b border-[#444] sticky top-0 z-10 text-[10.5px] text-[color:var(--text-primary)] font-sans py-1 cursor-default shrink-0">
                <div className="w-[280px] border-r border-[#444] px-1.5 flex items-center justify-between">Name <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[110px] border-r border-[#444] px-1.5 flex items-center justify-between">Profiles <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[70px] border-r border-[#444] px-1.5 flex items-center justify-between">Action <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[180px] border-r border-[#444] px-1.5 flex items-center justify-between">Address <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[100px] border-r border-[#444] px-1.5 flex items-center justify-between">Port <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[70px] border-r border-[#444] px-1.5 flex items-center justify-between">Protocol <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="w-[70px] border-r border-[#444] px-1.5 flex items-center justify-between">Interface <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
                <div className="flex-1 px-1.5 flex items-center justify-between">Application <ChevronDown size={11} className="text-[color:var(--text-muted)] opacity-50" /></div>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar">
                <div className="flex flex-col min-w-[1000px] pb-[40px]">
                   {fwData.map((row, i) => (
                       <div key={i} className={`flex items-center text-[10.5px] hover:bg-[#2a2d3e] border-b border-[color:var(--bg-surface-1)] py-[3px] cursor-pointer ${i%2===0 ? 'bg-[color:var(--bg-app)]' : 'bg-[#222]'} transition-colors`}>
                           <div className="w-[280px] flex items-center gap-1.5 shrink-0 border-r border-[#333] px-1.5 whitespace-nowrap overflow-hidden">
                               <CheckIcon />
                               <span className="text-[color:var(--text-primary)] truncate">{row.n}</span>
                           </div>
                           <div className="w-[110px] text-right text-[color:var(--text-muted)] shrink-0 border-r border-[#333] px-1.5 truncate">{row.pr}</div>
                           <div className="w-[70px] text-left text-[color:var(--text-primary)] shrink-0 border-r border-[#333] px-1.5 truncate pl-3">{row.act}</div>
                           <div className="w-[180px] text-right text-[color:var(--text-muted)] shrink-0 border-r border-[#333] px-1.5 truncate">{row.addr}</div>
                           <div className="w-[100px] text-right text-[color:var(--text-muted)] shrink-0 border-r border-[#333] px-1.5 truncate">{row.port}</div>
                           <div className="w-[70px] text-right text-[color:var(--text-muted)] shrink-0 border-r border-[#333] px-1.5 truncate">{row.proto}</div>
                           <div className="w-[70px] text-right text-[color:var(--text-muted)] shrink-0 border-r border-[#333] px-1.5 truncate">{row.inf}</div>
                           <div className="flex-1 text-right text-[color:var(--text-muted)] px-1.5 truncate">{row.app}</div>
                       </div>
                   ))}
                   {[...Array(30)].map((_, i) => (
                       <div key={`fillfw-${i}`} className={`flex border-b border-[color:var(--bg-surface-1)] h-[21px] ${ (i+fwData.length)%2===0 ? 'bg-[color:var(--bg-app)]' : 'bg-[#222]'}`}>
                           <div className="w-[280px] border-r border-[#333]"></div>
                           <div className="w-[110px] border-r border-[#333]"></div>
                           <div className="w-[70px] border-r border-[#333]"></div>
                           <div className="w-[180px] border-r border-[#333]"></div>
                           <div className="w-[100px] border-r border-[#333]"></div>
                           <div className="w-[70px] border-r border-[#333]"></div>
                           <div className="w-[70px] border-r border-[#333]"></div>
                           <div className="flex-1"></div>
                       </div>
                   ))}
                </div>
            </div>
        </div>
    )
}

const ServerStatusPanel = ({ serverName = "Main Trade Server", initialTab }) => {
   const [bottomTab, setBottomTab] = useState(initialTab || 'Overview');
   const bottomTabs = ['Status', 'Overview', 'Devices', 'CPU', 'Memory', 'Disk', 'Connections', 'Network', 'Trade', 'Threads', 'OS Events', 'Windows Firewall', 'Journal'];

   React.useEffect(() => {
     if (initialTab) {
       setBottomTab(initialTab);
     }
   }, [initialTab]);

   // Chart configs
   const stack_cpu = [
       { labels: [{ c: '#3b82f6', t: 'CPU total: 1%, 8 cores' }, { c: '#4ade80', t: 'CPU process: 0%' }, { c: '#f59e0b', t: 'CPU DPC: 0' }, { c: '#06b6d4', t: 'CPU interrupts: 0' }], unit: '%', yAxis: ['100', '80', '60', '40', '20', '0'], lines: [{ s: 'spike-blue', c: '#3b82f6' }, { s: 'flat-bottom', c: '#4ade80' }, { s: 'flat-bottom', c: '#f59e0b' }, { s: 'flat-bottom', c: '#06b6d4' }] },
       { labels: [{ c: '#3b82f6', t: 'Threads: 154' }], yAxis: ['200', '160', '120', '80', '40', '0'], lines: [{ s: 'threads-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Handles total: 114 351' }, { c: '#4ade80', t: 'Handles process: 2 958' }], yAxis: ['150 000', '120 000', '90 000', '60 000', '30 000', '0'], lines: [{ s: 'handles-blue', c: '#3b82f6' }, { s: 'flat-zero', c: '#4ade80' }] }
   ];

   const stack_memory = [
       { labels: [{ c: '#3b82f6', t: 'Free memory: 46 107 MB, 70.46%' }], unit: 'MB, %', yAxis: ['100', '80', '60', '40', '20', '0'], lines: [{ s: 'memory-free', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Process memory: 4 167 MB' }], yAxis: ['5 000', '4 000', '3 000', '2 000', '1 000', '0'], lines: [{ s: 'memory-process', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Page faults: 5 124' }], yAxis: ['600 00', '500 00', '400 00', '300 00', '200 00', '100 00', '0'], lines: [{ s: 'page-faults', c: '#3b82f6' }] }
   ];

   const stack_disk = [
       { labels: [{ c: '#3b82f6', t: 'Free disk space: 460 638 MB, 60.06% of 748 GB' }], unit: 'MB, %', yAxis: ['100', '80', '60', '40', '20', '0'], lines: [{ s: 'memory-free', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'IOPS: 5' }], yAxis: ['1 000', '800', '600', '400', '200', '0'], lines: [{ s: 'iops-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Queue length: 0' }], yAxis: ['12', '10', '8', '6', '4', '2', '0'], lines: [{ s: 'flat-zero', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Average latency: 0.28 ms' }], unit: 'ms', yAxis: ['3.20', '2.40', '1.60', '0.80', '0.00'], lines: [{ s: 'latency-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Read: 0 MB' }, { c: '#4ade80', t: 'Write: 0 MB' }], unit: 'MB', yAxis: ['500', '400', '300', '200', '100', '0'], lines: [{ s: 'sawtooth-blue', c: '#3b82f6' }, { s: 'flat-zero', c: '#4ade80' }], isShort: true }
   ];

   const stack_connections = [
       { labels: [{ c: '#3b82f6', t: 'Connections total: 1 284' }, { c: '#4ade80', t: 'Active: 890' }], yAxis: ['2 000', '1 600', '1 200', '800', '400', '0'], lines: [{ s: 'memory-free', c: '#3b82f6' }, { s: 'threads-blue', c: '#4ade80' }] },
       { labels: [{ c: '#3b82f6', t: 'Logins/sec: 14' }], yAxis: ['50', '40', '30', '20', '10', '0'], lines: [{ s: 'iops-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Auth failures: 0' }], yAxis: ['10', '8', '6', '4', '2', '0'], lines: [{ s: 'flat-zero', c: '#3b82f6' }] }
   ];

   const stack_network = [
       { labels: [{ c: '#3b82f6', t: 'Traffic IN: 412 MB/s' }, { c: '#4ade80', t: 'Traffic OUT: 184 MB/s' }], unit: 'MB/s', yAxis: ['500', '400', '300', '200', '100', '0'], lines: [{ s: 'iops-blue', c: '#3b82f6' }, { s: 'memory-free', c: '#4ade80' }] },
       { labels: [{ c: '#3b82f6', t: 'Packets/sec: 12 405' }], yAxis: ['20 000', '16 000', '12 000', '8 000', '4 000', '0'], lines: [{ s: 'spike-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Dropped Packets: 4' }], yAxis: ['100', '80', '60', '40', '20', '0'], lines: [{ s: 'latency-blue', c: '#3b82f6' }] }
   ];

   const stack_trade = [
       { labels: [{ c: '#3b82f6', t: 'Orders received: 43/s' }, { c: '#4ade80', t: 'Deals executed: 25/s' }], yAxis: ['100', '80', '60', '40', '20', '0'], lines: [{ s: 'page-faults', c: '#3b82f6' }, { s: 'handles-blue', c: '#4ade80' }] },
       { labels: [{ c: '#3b82f6', t: 'Avg execution time: 0.8 ms' }], unit: 'ms', yAxis: ['5.0', '4.0', '3.0', '2.0', '1.0', '0.0'], lines: [{ s: 'latency-blue', c: '#3b82f6' }] },
       { labels: [{ c: '#3b82f6', t: 'Rejected: 0' }], yAxis: ['20', '16', '12', '8', '4', '0'], lines: [{ s: 'flat-zero', c: '#3b82f6' }] }
   ];

   return (
      <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col h-full font-sans text-[color:var(--text-primary)] overflow-hidden">
         
         {/* Main Content Area */}
         <div className="flex-1 flex flex-col overflow-auto no-scrollbar">
            {bottomTab === 'Status' ? (
               <div className="p-4 flex flex-col gap-6">
                  {/* Header */}
                  <div className="flex justify-between items-start pt-1">
                     <div>
                        <div className="flex items-center gap-2 mb-1.5">
                           <h1 className="text-xl font-medium text-white">{serverName}</h1>
                           <Settings size={14} className="text-[#3b82f6] cursor-pointer hover:text-blue-400" />
                        </div>
                        <div className="text-[11px] text-[color:var(--text-muted)] tracking-wide">
                           Version: 5.00 build 5370 (17 Oct 2025), last boot 2026.03.29 03:57
                        </div>
                     </div>
                     <button className="flex items-center gap-2 px-3 py-1 border border-[#555] rounded-[3px] hover:bg-[#333] bg-transparent text-[11px] text-[color:var(--text-primary)] transition-colors mt-2">
                        <RefreshCw size={12} className="text-[#4ade80]" />
                        Restart server
                     </button>
                  </div>

                  <div className="border-t border-[#333] w-full mt-[-8px]" />

                  {/* Hardware Info Row */}
                  <div className="grid grid-cols-4 gap-8 max-w-4xl mt-[-2px]">
                     <div>
                        <div className="text-[11px] text-[color:var(--text-muted)] mb-1">Operating system</div>
                        <div className="text-[11px] text-white">Windows Server 2022 Standard</div>
                     </div>
                     <div>
                        <div className="text-[11px] text-[color:var(--text-muted)] mb-1">Processor</div>
                        <div className="text-[11px] text-white">8 x Intel Xeon E-2234 @ 3.60GHz</div>
                     </div>
                     <div>
                        <div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Memory</div>
                        <div className="text-[11px] text-white">19 / 64 GB</div>
                     </div>
                     <div>
                        <div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Disk</div>
                        <div className="text-[11px] text-white">300 / 748 GB</div>
                     </div>
                  </div>

                  {/* Databases Section */}
                  <div className="flex flex-col gap-3 mt-4">
                     <div className="text-[13px] text-[color:var(--text-primary)]">Databases</div>
                     <div className="grid grid-cols-6 gap-4 max-w-4xl">
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Groups</div><div className="text-[11px] text-white">127</div></div>
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Accounts</div><div className="text-[11px] text-white">9 789</div></div>
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Real accounts</div><div className="text-[11px] text-white">8 752 / 25 000</div></div>
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Positions</div><div className="text-[11px] text-white">1 663</div></div>
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Orders</div><div className="text-[11px] text-white">103 / 2 377 099</div></div>
                        <div><div className="text-[11px] text-[color:var(--text-muted)] mb-1">Deals</div><div className="text-[11px] text-white">1 474 882</div></div>
                     </div>
                  </div>

                  {/* Maximum, last 24hrs */}
                  <div className="flex flex-col gap-3 mt-4">
                     <div className="text-[13px] text-[color:var(--text-primary)]">Maximum, last 24hrs</div>
                     <div className="grid grid-cols-6 gap-4 max-w-4xl">
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Connections</div><div className="text-[11px] text-white">24</div></div>
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Active Sockets</div><div className="text-[11px] text-white">161</div></div>
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Network load</div><div className="text-[11px] text-white">0.8 Mbps</div></div>
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">CPU load</div><div className="text-[11px] text-[#ef4444]">73%</div></div>
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Memory</div><div className="text-[11px] text-white">20 / 64 GB</div></div>
                        <div><div className="text-[11px] text-[#3b82f6] mb-1 cursor-pointer hover:underline hover:text-blue-400">Disk speed</div><div className="text-[11px] text-white">read 533 / write 247</div></div>
                     </div>
                  </div>

                  {/* Ping Section */}
                  <div className="flex flex-col gap-3 mt-4">
                     <div className="text-[13px] text-[color:var(--text-primary)]">Ping</div>
                     <div className="flex gap-16 max-w-4xl text-[11px]">
                        <div className="flex flex-col gap-2">
                           <div className="flex justify-between w-48"><span className="text-[color:var(--text-primary)]">History Server</span><span className="text-[color:var(--text-primary)]">0.01 ms</span></div>
                           <div className="flex justify-between w-48"><span className="text-[color:var(--text-primary)]">Access Server</span><span className="text-[color:var(--text-primary)]">0.01 ms</span></div>
                           <div className="flex justify-between w-48"><span className="text-[color:var(--text-primary)]">Access Server</span><span className="text-[color:var(--text-primary)]">5.42 ms</span></div>
                        </div>
                        <div className="flex flex-col gap-2">
                           <div className="flex justify-between w-56"><span className="text-[color:var(--text-primary)]">Local Main Status Server</span><span className="text-[color:var(--text-primary)]">0.01 ms</span></div>
                           <div className="flex justify-between w-56"><span className="text-[color:var(--text-primary)]">TradeProcessor SQL_Export</span><span className="text-[color:var(--text-primary)]">1.43 ms</span></div>
                           <div className="flex justify-between w-56"><span className="text-[color:var(--text-primary)]">MainTrade Backup Server</span><span className="text-[color:var(--text-primary)]">5.43 ms</span></div>
                           <div className="flex justify-between w-56"><span className="text-[color:var(--text-primary)]">History Backup Server</span><span className="text-[color:var(--text-primary)]">5.44 ms</span></div>
                        </div>
                     </div>
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-col gap-3 mt-4 border-t border-[#333] pt-6 pb-4">
                     <div className="text-[13px] text-[color:var(--text-primary)]">Best practices and recommendations</div>
                     <div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-primary)] mb-2 cursor-pointer w-max select-none">
                           <ChevronDown size={14} className="text-[color:var(--text-muted)]"/>
                           System
                        </div>
                        <div className="text-[11px] text-[#3b82f6] ml-6 max-w-3xl leading-relaxed cursor-pointer hover:underline">
                           We recommend replacing the hardware, since it was made in November 2019. It is undesirable to use hardware older than 5 years for trade servers
                        </div>
                     </div>
                  </div>

               </div>
            ) : bottomTab === 'Overview' ? (
               <div className="flex-1 grid grid-cols-2 grid-rows-4 gap-[2px] bg-[#333] p-[2px] min-h-[600px] overflow-hidden">
                   <OverviewMiniGraph type="CPU" />
                   <OverviewMiniGraph type="Traffic" />
                   <OverviewMiniGraph type="Packets" />
                   <OverviewMiniGraph type="ReadWrite" />
                   <OverviewMiniGraph type="Deals" />
                   <OverviewMiniGraph type="Memory" />
                   <OverviewMiniGraph type="Handles" />
                   <OverviewMiniGraph type="Disk" />
               </div>
            ) : bottomTab === 'Devices' ? (
                <div className="flex-1 flex flex-col overflow-auto bg-[color:var(--bg-app)]">
                    <div className="px-3 pb-3 pt-2">
                        <div className="text-xl text-white font-medium mb-[2px]">{serverName}</div>
                        <div className="text-[12px] text-[color:var(--text-primary)]">Overall performance index: 32%</div>
                    </div>
         
                    <div className="flex flex-col py-1 overflow-x-auto no-scrollbar border-t border-[#333]">
                        <div className="flex flex-col min-w-[900px] w-full">
                            <div className="flex items-center gap-1.5 px-0.5 py-[3px] border border-[#3b82f6] bg-[#1a2d48] cursor-pointer w-max mb-1.5 ml-1">
                               <div className="w-[10px] h-[10px] bg-transparent border border-[color:var(--text-muted)] flex items-center justify-center text-[color:var(--text-muted)] text-[8px] font-bold shrink-0 ml-[1px]">-</div>
                               <Monitor size={14} className="text-[#4ade80] mx-0.5" />
                               <span className="text-[11.5px] text-[color:var(--text-primary)] pr-2 shadow-sm font-sans">ZLD-FLX-M5LP1 / Windows Server 2022 build 20348, AVX2/CLANG, Windows license activated</span>
                            </div>
         
                            {/* Children */}
                            <DeviceRow indent={1} icon={Settings} text="Platform: Supermicro SYS-5039MC-H12TRF" />
                            <DeviceRow indent={1} icon={Settings} text="Motherboard: Supermicro - X11SCE-F 1.02" />
                            <DeviceRow indent={1} icon={Settings} iconColor="text-[#4ade80]" text="BIOS: SUPERM - 1072009, 1.2, date: 2019.11.21" />
                            <DeviceRow indent={1} icon={Cpu} text="CPU: Intel Xeon E-2234 @ 3.60GHz, 8 cores, 1 NUMA nodes" statBar={{type: 'normal', label: 'frequency:', val: '3 601 Mhz'}} />
                            <DeviceRow indent={1} icon={HardDrive} text="RAM: 64 GB, Large Pages ON" statBar={{type: 'normal', label: 'bandwidth:', val: '32 GB/s'}} />
                            <DeviceRow indent={1} icon={Globe} iconColor="text-[#4ade80]" text="Network Speed: 922 Mbit/s" statBar={{type: 'normal', label: 'bandwidth:', val: '922 Mbit/s'}} />
                            
                            <DeviceRow indent={1} expandable expanded text="Disk Drives (1)" icon={HardDrive}>
                               <div className="flex flex-col">
                                  <DeviceRow indent={2} icon={HardDrive} text="0: Intel Raid 1 Volume, cache read ON, write ON" statBar={{type: 'disk'}} />
                                  <DeviceRow indent={2} expandable expanded={false} text="Volumes (2)" icon={HardDrive} />
                               </div>
                            </DeviceRow>
                            
                            <DeviceRow indent={1} expandable expanded={false} text="Network (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Remote Control (3)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Display Adapter (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="System (31)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Storage Adapter (2)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Software Device (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Keyboard (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Mouse (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Human Interface Device (2)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Monitor (1)" />
                            <DeviceRow indent={1} expandable expanded={false} text="USB (4)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Ports (2)" />
                            <DeviceRow indent={1} expandable expanded={false} text="Services (79)" />
                        </div>
                    </div>
                </div>
            ) : bottomTab === 'CPU' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_cpu.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_cpu.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Memory' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_memory.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_memory.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Disk' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_disk.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_disk.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Connections' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_connections.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_connections.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Network' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_network.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_network.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Trade' ? (
                <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden">
                   {stack_trade.map((cfg, idx) => (
                       <StackedGraphRow key={idx} cfg={cfg} isLast={idx === stack_trade.length - 1} isShort={cfg.isShort} />
                   ))}
                </div>
            ) : bottomTab === 'Threads' ? (
                <ThreadsTab />
            ) : bottomTab === 'Windows Firewall' ? (
                <FirewallTab />
            ) : (
               <div className="flex-1 flex items-center justify-center text-[color:var(--text-muted)] text-sm">
                  No data available for {bottomTab}
               </div>
            )}
         </div>

         {/* Bottom Tabs Component */}
         <div className="h-[22px] bg-[color:var(--bg-app)] border-t border-[#444] flex px-2 overflow-x-auto no-scrollbar shrink-0">
            {bottomTabs.map(tab => (
               <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`px-3 flex items-center text-[10.5px] whitespace-nowrap outline-none transition-colors ${
                     bottomTab === tab 
                     ? 'bg-[color:var(--bg-surface-2)] text-white border-x border-[#444] font-medium' 
                     : 'text-[color:var(--text-muted)] hover:bg-white/5 border-x border-transparent'
                  }`}
               >
                  {tab}
               </button>
            ))}
         </div>
      </div>
   );
};

export default ServerStatusPanel;
