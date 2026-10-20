import React from 'react';
import { Settings, CheckCircle2, User, AlertTriangle, Shield, Server, ArrowRight, ShieldAlert, Users } from 'lucide-react';

// Sweep SUI-A6: vendor requests and proxy provisioning have no admin API, so
// the buttons stay disabled with the reason instead of faking a request.
const VENDOR_REQUEST_UNAVAILABLE = 'Vendor requests are handled by your platform provider and cannot be sent from this workspace.';
const ADD_PROXY_UNAVAILABLE = 'Proxy servers are provisioned by your platform provider and cannot be added from this workspace.';

const VendorItem = ({ logo, name, description }) => (
  <div className="flex gap-4 mb-8">
    <div className="w-[85px] h-[85px] bg-[color:var(--bg-app)] border border-[#333] shrink-0 flex items-center justify-center p-2">
      {logo}
    </div>
    <div className="flex flex-col items-start pt-1">
      <a href="#" className="text-[12.5px] font-semibold text-white hover:underline mb-1.5">{name}</a>
      <p className="text-[11px] text-[color:var(--text-muted)] leading-relaxed max-w-[1100px] mb-3">
        {description}
      </p>
      <button
        type="button"
        disabled
        title={VENDOR_REQUEST_UNAVAILABLE}
        aria-disabled="true"
        className="bg-[#00a651] text-white px-4 py-1.5 rounded-[2px] text-[11.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send request
      </button>
    </div>
  </div>
);

// SVG Helper for Hacker
const HackerIcon = ({ size=20, color="var(--danger-500)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    <circle cx="12" cy="16" r="1"/>
    <path d="M4 11h16"/>
  </svg>
);

const AntiDDoSView = () => {
  return (
    <div className="flex-1 bg-[color:var(--bg-app)] overflow-y-auto no-scrollbar py-6 px-8 rounded-tl-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-[color:var(--text-primary)]">
      <div className="max-w-[1300px] flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-[22px] font-normal text-white flex items-center gap-2 tracking-tight">
              Anti DDoS Protection <Settings className="text-white" size={16}/>
            </h1>
            <a href="#" className="text-[12px] text-white hover:underline mt-[2px] block font-sans">How to set up</a>
          </div>
          <button
            type="button"
            disabled
            title={ADD_PROXY_UNAVAILABLE}
            aria-disabled="true"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#555] rounded-[2px] text-[11.5px] text-[color:var(--text-primary)] transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={13} className="text-white"/>
            Add Proxy Server
          </button>
        </div>

        <div className="border-t border-[#333] w-full mb-8 pt-6"></div>

        {/* Infographic Section */}
        <div className="flex justify-center mb-10 w-full select-none">
          <div className="relative w-[700px] h-[220px] flex items-center justify-center">
            
            {/* Hackers (Red) */}
            <div className="absolute left-[80px] top-[20px] flex flex-col items-center gap-0.5">
               <div className="text-[#ef4444]"><ShieldAlert size={18} fill="#ef4444" className="text-black"/></div>
            </div>
            <div className="absolute left-[50px] top-[60px] flex flex-col items-center gap-0.5">
               <div className="text-[#ef4444]"><ShieldAlert size={18} fill="#ef4444" className="text-black"/></div>
            </div>
            <div className="absolute left-[90px] top-[85px] flex flex-col items-center gap-0.5">
               <div className="text-[#ef4444]"><ShieldAlert size={18} fill="#ef4444" className="text-black"/></div>
            </div>
            <div className="absolute left-[50px] top-[140px] flex flex-col items-center gap-0.5">
               <div className="text-[#ef4444]"><ShieldAlert size={18} fill="#ef4444" className="text-black"/></div>
            </div>
            <div className="absolute left-[85px] top-[180px] flex flex-col items-center gap-0.5">
               <div className="text-[#ef4444]"><ShieldAlert size={18} fill="#ef4444" className="text-black"/></div>
            </div>

            {/* Normal Users (Green) */}
            <div className="absolute left-[40px] top-[105px] flex flex-col items-center gap-0.5">
               <User size={18} className="text-white font-bold" />
               <span className="text-[9px] text-white font-bold tracking-wider">USER</span>
            </div>
            <div className="absolute left-[80px] top-[220px] flex flex-col items-center gap-0.5">
               <User size={18} className="text-white font-bold" />
               <span className="text-[9px] text-white font-bold tracking-wider">USER</span>
            </div>

            {/* Connection Lines to Alert Triangle */}
            <svg className="absolute left-[110px] top-0 w-[200px] h-full pointer-events-none" style={{ zIndex: 0 }}>
               {/* Red lines to X */}
               <line x1="0" y1="28" x2="150" y2="90" stroke="var(--danger-500)" strokeWidth="0.5" strokeDasharray="3 2" />
               <line x1="-30" y1="68" x2="150" y2="93" stroke="var(--danger-500)" strokeWidth="0.5" strokeDasharray="3 2" />
               <line x1="10" y1="93" x2="150" y2="96" stroke="var(--danger-500)" strokeWidth="0.5" strokeDasharray="3 2" />
               <line x1="-30" y1="148" x2="150" y2="103" stroke="var(--danger-500)" strokeWidth="0.5" strokeDasharray="3 2" />
               <line x1="5" y1="188" x2="150" y2="106" stroke="var(--danger-500)" strokeWidth="0.5" strokeDasharray="3 2" />
            </svg>

            {/* Connection Lines from Users to Shield */}
            <svg className="absolute left-[60px] top-0 w-[350px] h-full pointer-events-none" style={{ zIndex: 0 }}>
               {/* Green lines */}
               <path d="M 0 115 Q 160 120 280 100" fill="none" stroke="var(--success-500)" strokeWidth="0.5" />
               <path d="M 40 230 Q 200 240 280 120" fill="none" stroke="var(--success-500)" strokeWidth="0.5" />
            </svg>

            {/* Alert & Red X's */}
            <div className="absolute left-[260px] top-[90px] flex items-center gap-1 z-10">
               <AlertTriangle size={15} className="text-[#ef4444]" />
               <div className="text-[10px] text-[#ef4444] font-mono tracking-[3px] ml-1">× ×<br/>× ×</div>
            </div>

            {/* Radar Shield Rings */}
            <div className="absolute left-[335px] top-[60px] flex items-center justify-center z-10">
               <div className="w-[80px] h-[80px] rounded-full border-l-4 border-t-2 border-[#1d4ed8] absolute opacity-40 rotate-45"></div>
               <div className="w-[60px] h-[60px] rounded-full border-l-[3px] border-[#2563eb] absolute opacity-60 rotate-45"></div>
               <div className="w-[45px] h-[45px] rounded-full border-l-[3px] border-[#3b82f6] absolute opacity-80 rotate-45"></div>
               
               <div className="w-[30px] h-[30px] bg-[#1e3a8a] rounded-sm flex items-center justify-center border border-[#3b82f6] z-20 absolute -left-1">
                  <Shield size={16} fill="none" className="text-white"/>
                  <rect x="11" y="11" width="8" height="6" rx="1" fill="#60a5fa" className="absolute"/>
                  <path d="M12 11V9a3 3 0 0 1 6 0v2" stroke="#60a5fa" strokeWidth="1.5" className="absolute" />
               </div>
               
               <div className="absolute top-[50px] -left-[10px] text-[8px] font-bold text-[color:var(--text-muted)] text-center tracking-wide w-24">
                  ANTI-DDOS<br/>PROTECTION
               </div>
            </div>

            {/* Access Servers Box */}
            <div className="absolute left-[440px] top-[60px] flex flex-col items-center z-10">
               <div className="w-[40px] h-[40px] border border-[#3b82f6] rounded-[2px] flex flex-col justify-evenly p-1 bg-[color:var(--bg-app)]">
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
               </div>
               <div className="text-[8px] font-bold text-[color:var(--text-muted)] text-center tracking-wide mt-2 w-16">
                  ACCESS<br/>SERVERS
               </div>
            </div>

            {/* Connection line between AntiDDoS and Access */}
            <div className="absolute left-[370px] top-[75px] flex items-center justify-center z-0 w-[70px]">
               <div className="w-full h-[1px] bg-[#3b82f6]"></div>
               <div className="absolute flex gap-1 bg-[#222222] px-1">
                 <CheckCircle2 size={10} className="text-white"/>
                 <CheckCircle2 size={10} className="text-white"/>
               </div>
            </div>

            {/* Trade and History Servers Box */}
            <div className="absolute left-[560px] top-[60px] flex flex-col items-center z-10">
               <div className="w-[40px] h-[40px] border border-[#3b82f6] rounded-[2px] flex flex-col justify-evenly p-1 bg-[color:var(--bg-app)]">
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
                  <div className="h-[4px] bg-[#1d4ed8] rounded-[1px] w-full relative"><div className="absolute right-1 top-0 bottom-0 w-[2px] bg-[#4ade80]"></div></div>
               </div>
               {/* Tiny security lock attachment */}
               <div className="absolute -bottom-1 -right-1 bg-[#fff] rounded-full p-[1px] z-20">
                 <div className="bg-[color:var(--accent-500)] rounded-full p-[2px]">
                   <Shield size={6} fill="#fff" className="text-white"/>
                 </div>
               </div>

               <div className="text-[8px] font-bold text-[color:var(--text-muted)] text-center tracking-wide mt-2 w-24">
                  TRADE AND HISTORY<br/>SERVERS
               </div>
            </div>

            {/* Connection line between Access and Trade Servers */}
            <div className="absolute left-[480px] top-[75px] flex items-center justify-center z-0 w-[80px]">
               <div className="w-full h-[1px] bg-[#3b82f6]"></div>
               <div className="absolute flex gap-1 bg-[#222222] px-1">
                 <CheckCircle2 size={10} className="text-white"/>
                 <CheckCircle2 size={10} className="text-white"/>
               </div>
            </div>

          </div>
        </div>

        {/* Text Description */}
        <div className="mb-8">
          <p className="text-[12px] text-[color:var(--text-primary)] leading-relaxed mb-1.5 font-sans">
            Protect your RTX5 access servers from DDoS attacks by applying professional solutions offered by our partners. Installation is quick and does not require any changes in your existing network infrastructure.
          </p>
          <p className="text-[12px] text-[color:var(--text-primary)] leading-relaxed font-sans max-w-[1250px]">
            With the Anti-DDoS proxy server component, unwanted connections are blocked on the distributed network of an external provider's servers rather than on your access servers. The network will reject unwanted connections, while legitimate connections from real clients will be forwarded to access servers.
          </p>
        </div>

        {/* Vendors Supported List */}
        <div className="mb-4">
          <h2 className="text-[14px] font-normal text-[color:var(--text-primary)] mb-2">Vendors supported:</h2>
          <p role="note" className="text-[11px] text-[color:var(--text-muted)] leading-relaxed mb-5 font-sans">
            {VENDOR_REQUEST_UNAVAILABLE}
          </p>

          <VendorItem 
            logo={
              <div className="flex items-center text-[#ff9900] font-bold text-[18px]">
                <div className="text-white mr-[-8px] text-[26px]">C</div>
                <span className="z-10 bg-[color:var(--bg-app)] pr-1 mt-1">Akamai</span>
              </div>
            }
            name="Akamai"
            description="Fully managed DDoS protection solutions for your applications, data centers, and network infrastructure. Offering protection against the largest and most sophisticated attacks, Akamai helps you safeguard your RTX5 platform from the risks of downtime. The vendor's globally distributed platform combines high capacity scrubbing centers with fast and effective response to attacks."
          />

          <VendorItem 
            logo={
              <div className="flex items-center text-[color:var(--text-muted)] font-normal tracking-[-0.5px] text-[15px]">
                <span className="text-[20px] font-medium mr-[2px]">C</span><span className="text-[10px] mt-1">QRATOR LABS</span>
              </div>
            }
            name="QRATOR"
            description="The Qrator offers a network-based protection against DDoS attacks and intrusions. The network nodes are connected to the largest mainline Internet service providers of United States, Russia, Eastern and Western Europe, Southeast Asia. Every filtering node operates independently, so in case one of them stops working, the traffic will be redirected to the neighboring node."
          />

          <VendorItem 
            logo={
              <div className="flex flex-col items-center justify-center font-bold text-[color:var(--text-primary)] text-[10px] gap-1">
                <Cloud size={24} className="text-[#f59e0b]" fill="#f59e0b"/>
                <span className="tracking-tight">CLOUDFLARE</span>
              </div>
            }
            name="CloudFlare"
            description="Cloudflare's layered security approach combines multiple DDoS mitigation capabilities into one service. It prevents disruptions caused by bad traffic, while allowing good traffic through, keeping your infrastructure highly available and performant. The global network spans 210 cities and operates within 100 milliseconds of 99% of the Internet-connected population in the developed world."
          />
        </div>
        
        {/* Footer Area */}
        <div className="mt-8 pt-6 border-t border-[#333] text-[12px] text-[color:var(--text-muted)] font-sans pb-10">
          <a href="#" className="text-white hover:underline">Sign in to the Support Center</a> to receive RTX5 platform user support: articles, news, documents and direct contact with the technical support team. Explore the AppStore and enhance the RTX5 platform functionality using third-party applications: liquidity solutions, news feeds, and money management tools, amongst others.
        </div>
      </div>
    </div>
  );
};

// Internal minimal cloud replacement for rendering
const Cloud = ({ size, className, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.1332 20.1788 10.2033 17.857 10.0216C17.4202 6.63412 14.5298 4 11 4C7.13401 4 4 7.13401 4 11C4 11.2384 4.01191 11.474 4.03517 11.7061C1.76569 12.0238 0 14.0373 0 16.5C0 19.5376 2.46243 22 5.5 22H17.5C18.6046 22 19.5 21.1046 19.5 20C19.5 18.8954 18.6046 18 17.5 18V19Z" />
  </svg>
)

export default AntiDDoSView;
