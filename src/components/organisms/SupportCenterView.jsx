import React from 'react';
import { Mail, Key, Send, Search, GraduationCap } from 'lucide-react';

const SupportCenterView = () => {
  return (
    <div className="flex-1 bg-[color:var(--bg-app)] overflow-y-auto no-scrollbar py-6 px-8 rounded-tl-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-[color:var(--text-primary)]">
      <div className="max-w-[1300px] flex flex-col h-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-normal text-white mb-0.5 tracking-tight">Orrnn Support Center</h1>
          <div className="text-[12.5px] font-sans">
            <a href="mailto:support@orrnn.com" className="text-[#3b82f6] hover:underline">support@orrnn.com</a>
            <span className="text-[#888] ml-1">— Authorization</span>
          </div>
        </div>

        <div className="border-t border-[#333] w-full mb-[50px]"></div>

        {/* Login Area */}
        <div className="flex flex-col items-center justify-center max-w-[500px] mx-auto w-full mb-[70px]">
          <p className="text-[13px] text-[color:var(--text-primary)] text-center mb-4 leading-relaxed font-sans">
            Orrnn Technical Support Center features unique information<br/>
            and provides direct access to assistance from our support team
          </p>
          
          <p className="text-[13px] text-[color:var(--text-primary)] text-center mb-5 font-sans">
            Only available to authorized users
          </p>

          <div className="w-full relative mb-3">
            <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Your email" 
              className="w-full bg-transparent border border-[#333] rounded-[2px] py-1.5 pl-10 pr-3 text-[13px] text-white focus:outline-none focus:border-[#555] h-[34px] placeholder-[color:var(--text-muted)]"
            />
          </div>

          <div className="w-full relative mb-3">
            <Key size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input 
              type="password" 
              placeholder="Support Center password" 
              className="w-full bg-transparent border border-[#333] rounded-[2px] py-1.5 pl-10 pr-3 text-[13px] text-white focus:outline-none focus:border-[#555] h-[34px] placeholder-[color:var(--text-muted)]"
            />
          </div>

          <div className="w-full flex justify-end mb-4">
            <a href="#" className="text-[12px] text-[#3b82f6] hover:underline font-sans">Password recovery</a>
          </div>

          <button className="w-full bg-[#00E676] hover:bg-[#00c853] text-[#000] py-2 rounded-[2px] text-[13px] font-medium transition-colors mb-5 h-[34px] flex items-center justify-center">
            Enter Orrnn Support Center
          </button>

          <div className="text-[12px] text-[color:var(--text-muted)] mb-3 font-sans">
            Don't have a Support Center account? <a href="#" className="text-[#3b82f6] hover:underline">Register</a>
          </div>

          <a href="#" className="flex items-center text-[12px] text-[#3b82f6] hover:underline gap-1.5 font-sans">
            <Send size={13} className="fill-[#3b82f6] text-white" /> Official Orrnn Support Channel
          </a>
        </div>

        {/* Features Area */}
        <div className="flex flex-col items-center max-w-[900px] mx-auto w-full">
          <p className="text-[13px] text-[color:var(--text-primary)] mb-8 font-sans">Support site features:</p>
          
          <div className="grid grid-cols-4 gap-8 w-full">
            
            {/* Feature 1 */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4ade80"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11.5px] font-bold text-[#fff] leading-tight mb-0.5 font-sans">Finteza</span>
                <span className="text-[11px] text-[color:var(--text-muted)] leading-snug font-sans w-[130px]">Use analytics for a brokerage business</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#3b82f6"/>
                  <path d="M8 12h8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 8l4 8-8 0z" fill="#4ade80" opacity="0.8"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11.5px] font-bold text-[#fff] leading-tight mb-0.5 font-sans">App Store</span>
                <span className="text-[11px] text-[color:var(--text-muted)] leading-snug font-sans w-[130px]">Get new RTX5 features</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 bg-[#d97706] rounded-full p-1 opacity-90 relative">
                <Search size={16} className="text-white" />
                <div className="absolute -bottom-1 -right-0.5">
                  <svg width="10" height="15" viewBox="0 0 10 15" fill="none">
                    <path d="M2 0v10l3-2 3 2V0H2z" fill="#fcd34d"/>
                  </svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11.5px] font-bold text-[#fff] leading-tight mb-0.5 font-sans">Certification</span>
                <span className="text-[11px] text-[color:var(--text-muted)] leading-snug font-sans w-[130px]">Confirm your platform usage skills</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 bg-[#0ea5e9] rounded-md p-1 opacity-90 relative">
                 <GraduationCap size={16} className="text-white" />
                 <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11.5px] font-bold text-[#fff] leading-tight mb-0.5 font-sans">Webinars</span>
                <span className="text-[11px] text-[color:var(--text-muted)] leading-snug font-sans w-[130px]">Find out how the platform can help you</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default SupportCenterView;
