import React from 'react';

const gateways = [
  {
    id: 1,
    name: 'ASX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex items-center gap-1 text-[#0f5c97] font-bold text-xl">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#3bb5e8]"><circle cx="12" cy="12" r="10" /><path stroke="white" strokeWidth="2" d="M8 12h8M12 8v8"/></svg>
          ASX
        </div>
      </div>
    )
  },
  {
    id: 2,
    name: 'BMFBOVESPA Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex flex-col items-center leading-none">
          <div className="text-[#0d347c] font-black text-2xl">[B]<sup className="text-sm">3</sup></div>
          <div className="text-[#0d347c] text-[5px] text-center whitespace-nowrap tracking-widest mt-0.5">BRAZILIAN<br/>EXCHANGE AND OTC</div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    name: 'Borsa Istanbul VIOP Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto overflow-hidden">
        <div className="flex items-center gap-1.5 text-[#0092ac] font-bold text-sm tracking-widest">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#0092ac]"><circle cx="12" cy="12" r="10" /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" /></svg>
          <div className="flex flex-col leading-none">
            <span>BORSA</span>
            <span>ISTANBUL</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 4,
    name: 'BSE Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto relative group">
        <div className="absolute inset-x-2 inset-y-0 opacity-0 bg-white shadow-sm transition-opacity"></div>
        <div className="flex items-center gap-1 text-[#623a9d] font-black text-2xl italic z-10">
          BSE<span className="text-[#f58220] ml-[-4px]">🔥</span>
        </div>
      </div>
    )
  },
  {
    id: 5,
    name: 'Cboe FX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex flex-col text-[#002f6c] font-bold text-2xl leading-none font-sans">
          Cboe
        </div>
      </div>
    )
  },
  {
    id: 6,
    name: 'Currenex Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="text-[#0057a6] font-bold text-xl tracking-wider">
          CURRENEX
        </div>
      </div>
    )
  },
  {
    id: 7,
    name: 'DGCX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex gap-2 items-center">
          <div className="text-[#cba052] font-semibold text-2xl tracking-tighter">DGCX</div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cba052" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>
        </div>
      </div>
    )
  },
  {
    id: 8,
    name: 'Euronext FX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex items-center gap-1 font-bold text-[#004e9a] text-sm">
          <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
            <div className="bg-[#4bc6df]"></div>
            <div className="bg-[#2a7b3b]"></div>
            <div className="bg-[#fdbb30]"></div>
            <div className="bg-[#d2232a]"></div>
          </div>
          EURONEXT FX
        </div>
      </div>
    )
  },
  {
    id: 9,
    name: 'FXCM Pro Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex items-center text-[#213f56] font-black text-xl italic tracking-tighter">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#213f56] -ml-2 mr-0.5">
            <path d="M5 22L12 12l-7-8L3 17z"/>
            <path d="M12 22l7-10-7-8-2 2z"/>
          </svg>
          FXCM <span className="bg-[#00adef] text-white not-italic text-[10px] pb-5pt px-1 ml-1 rounded-sm leading-tight inline-block">PRO</span>
        </div>
      </div>
    )
  },
  {
    id: 10,
    name: 'GBOT Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex text-3xl font-bold tracking-tight">
          <span className="text-[#0d347c]">G</span>
          <span className="text-[#4fa934]">B</span>
          <span className="text-[#f58220]">O</span>
          <span className="text-[#3bb5e8]">T</span>
        </div>
      </div>
    )
  },
  {
    id: 11,
    name: 'Integral Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="h-12 w-40 flex items-center justify-center p-2 mx-auto">
        <div className="text-[#444444] font-medium text-3xl opacity-50 tracking-tighter">
          Integral
        </div>
      </div>
    )
  },
  {
    id: 12,
    name: 'Interactive Brokers Gateway',
    build: '5.00 build 5100 (6 Jun 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="flex items-center gap-1 text-black font-semibold text-sm tracking-tight leading-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ce1126"><path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z"/></svg>
          <span>InteractiveBrokers</span>
        </div>
      </div>
    )
  },
  {
    id: 13,
    name: 'LMAX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="h-12 w-40 flex items-center justify-center p-2 mx-auto">
        <div className="flex items-center gap-2">
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#f02128" stroke="#ffffff" strokeWidth="0.5"/></svg>
           <div className="flex flex-col items-center">
             <div className="text-white font-bold tracking-widest text-xl leading-none">LMAX</div>
             <div className="text-[#999999] text-[6px] tracking-[0.3em] font-medium">GLOBAL</div>
           </div>
        </div>
      </div>
    )
  },
  {
    id: 14,
    name: 'MetaTrader 4 Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="relative">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-blue-500">
             <polygon points="12,2 22,8 22,18 12,24 2,18 2,8" fill="#1e90ff" stroke="#fff" strokeWidth="1"/>
           </svg>
           <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">4</span>
        </div>
      </div>
    )
  },
  {
    id: 15,
    name: 'MetaTrader 5 Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <div className="relative">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-green-500">
             <polygon points="12,2 22,8 22,18 12,24 2,18 2,8" fill="#ffb400" stroke="#fff" strokeWidth="1"/>
             <polygon points="12,8 16,11 16,16 12,19 8,16 8,11" fill="#32cd32"/>
           </svg>
           <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">5</span>
        </div>
      </div>
    )
  },
  {
    id: 16,
    name: 'MOEX Derivatives Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center gap-2 p-2 rounded-sm mx-auto">
        <div className="bg-[#cc0000] text-white p-1 rounded-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12l9-8v16zM21 12l-9-8v16z"/></svg></div>
        <div className="flex flex-col leading-none text-black font-bold text-xs tracking-tight"><span>MOSCOW</span><span>EXCHANGE</span></div>
      </div>
    )
  },
  {
    id: 17,
    name: 'MOEX Securities Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center gap-2 p-2 rounded-sm mx-auto">
        <div className="bg-[#cc0000] text-white p-1 rounded-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12l9-8v16zM21 12l-9-8v16z"/></svg></div>
        <div className="flex flex-col leading-none text-black font-bold text-xs tracking-tight"><span>MOSCOW</span><span>EXCHANGE</span></div>
      </div>
    )
  },
  {
    id: 18,
    name: 'MOEXFX Gateway',
    build: '5.00 build 5370 (17 Oct 2025)',
    logo: (
      <div className="bg-white h-12 w-40 flex items-center justify-center gap-2 p-2 rounded-sm mx-auto">
        <div className="bg-[#cc0000] text-white p-1 rounded-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12l9-8v16zM21 12l-9-8v16z"/></svg></div>
        <div className="flex flex-col leading-none text-black font-bold text-xs tracking-tight"><span>MOSCOW</span><span>EXCHANGE</span></div>
      </div>
    )
  },
  {
    id: 19,
    name: 'Remote gateway',
    build: '',
    logo: (
      <div className="h-12 w-40 flex items-center justify-center p-2 rounded-sm mx-auto">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f58220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform -rotate-45">
          <path d="M12 2l2 2-2 2-2-2 2-2zM4 10l8 8M14 8l6 6c1.1 1.1 1.1 2.9 0 4l-2 2c-1.1 1.1-2.9 1.1-4 0l-6-6M9.5 14.5l-5 5L2 22l2.5-2.5 5-5" />
        </svg>
      </div>
    )
  }
];

const GatewaysView = () => {
  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden text-[#e1e1e1]">
      {/* Header Area */}
      <div className="flex justify-between items-start px-5 py-4 border-b border-black/40 shrink-0 bg-[#252526]">
        <div>
          <h1 className="text-[17px] font-semibold text-white mb-1">Gateways</h1>
          <p className="text-[12px] text-[#aaaaaa]">Gateways connect the platform to liquidity providers and exchanges. Choose from built-in modules and App Store offerings or create custom solutions with Gateway API</p>
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-[#1e1e1e]">
        <div className="grid grid-cols-1 md:grid-cols-2 mt-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {gateways.map((gw) => (
            <div 
              key={gw.id} 
              className="flex flex-col items-center justify-between p-4 bg-[#1e1e1e] border border-[#333333] hover:border-[#555555] rounded-sm transition-colors cursor-pointer group hover:bg-[#252526] h-32"
            >
              <div className="mt-1 w-full text-center">
                {gw.logo}
              </div>
              <div className="mt-auto text-center w-full">
                <h3 className="text-[12px] font-medium text-[#dddddd] group-hover:text-white transition-colors">{gw.name}</h3>
                {gw.build && (
                  <p className="text-[#888888] text-[10px] mt-0.5">{gw.build}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GatewaysView;
