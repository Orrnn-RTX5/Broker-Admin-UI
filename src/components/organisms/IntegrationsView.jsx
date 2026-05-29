import React from 'react';
import { XCircle, Info, CheckCircle2, AtSign, Server, X } from 'lucide-react';

const IntegrationItem = ({ title, statuses, description, linkText, chart }) => {
  return (
    <div className="flex justify-between items-start mb-8 min-h-[80px]">
      <div className="flex flex-col max-w-[500px]">
        <h3 className="text-[15px] font-normal text-[color:var(--text-primary)] mb-2">{title}</h3>
        
        <div className="flex items-center gap-4 text-[11.5px] mb-2 font-sans">
          {statuses.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {stat.icon}
              <span className={stat.colorClass || "text-[color:var(--text-muted)]"}>
                {stat.label} {stat.value && <span className={stat.valueColor || "text-[color:var(--text-muted)]"}>{stat.value}</span>}
              </span>
            </div>
          ))}
        </div>
        
        <p className="text-[11.5px] text-[color:var(--text-primary)] leading-relaxed mb-1">{description}</p>
        
        {typeof linkText === 'string' ? (
          <a href="#" className="text-[11.5px] text-[#3B82F6] hover:underline hover:text-blue-400 cursor-pointer w-max">{linkText}</a>
        ) : (
          <div className="text-[11.5px] text-[#3B82F6] w-max">{linkText}</div>
        )}
      </div>

      {chart && (
        <div className="flex-1 max-w-[500px] flex ml-8 relative pt-2">
          {/* Chart area */}
          <div className="flex-1 relative flex justify-around items-end h-[60px] pb-1 border-b border-[#333]">
            {/* Horizontal Middle Line */}
            <div className="absolute w-full h-[1px] bg-[#333] top-[50%]"></div>
            
            {/* Left Bar (Successful) */}
            <div className="flex flex-col items-center z-10 w-28">
              <span className="text-[10px] text-[color:var(--text-primary)] mb-1 leading-tight text-center">
                {chart.successVal}<br />Successful
              </span>
              <div 
                className={`w-[120px] rounded-[1px] border ${chart.successVal > 0 ? 'border-[#3B82F6] bg-[#1e293b]' : 'border-transparent'} h-[4px] absolute bottom-[4px]`}
              ></div>
            </div>

            {/* Right Bar (Unsuccessful) */}
            <div className="flex flex-col items-center z-10 w-28">
              <span className="text-[10px] text-[color:var(--text-primary)] mb-1 leading-tight text-center">
                {chart.failVal}<br />Unsuccessful
              </span>
              <div 
                className={`w-[110px] rounded-[1px] ${chart.failVal > 0 ? 'bg-[#3f2020] border border-[#ef4444]' : 'border-transparent'} h-[20px] absolute bottom-[4px]`}
                style={{ height: chart.failVal > 0 ? (chart.failVal > 400 ? '24px' : '20px') : '0px' }}
              ></div>
            </div>
          </div>
          
          {/* Y Axis Labels */}
          <div className="w-[30px] flex flex-col justify-between items-end h-[60px] pb-[-4px] text-[10px] text-[color:var(--text-primary)] pl-2 z-10">
            <span>{chart.yMax}</span>
            <span className="mt-auto relative top-3">{chart.yMin}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const IntegrationsView = () => {
  return (
    <div className="flex-1 bg-[color:var(--bg-app)] overflow-y-auto no-scrollbar pt-6 px-8 rounded-tl-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-white mb-1 tracking-tight">Integration</h1>
        <a href="https://www.mql5.com" className="text-[#3b82f6] text-[12px] hover:underline">www.mql5.com</a>
      </div>

      <div className="flex flex-col max-w-[1100px]">
        <IntegrationItem 
          title="Finteza Analytics"
          statuses={[
            { icon: <XCircle size={13} className="text-[#ef4444]" />, label: 'Not Activated', colorClass: 'text-[#ef4444]' },
            { icon: <Info size={13} className="text-[#3b82f6]" />, label: 'MasterSite ID:', value: 'not specified', valueColor: 'text-[#ef4444]', colorClass: 'text-[#3b82f6]' },
            { icon: <Info size={13} className="text-[#3b82f6]" />, label: 'Data:', value: 'no export', valueColor: 'text-[#ef4444]', colorClass: 'text-[#3b82f6]' }
          ]}
          description="Use end-to-end brokerage analytics for RTX5."
          linkText="More about the service"
        />

        <IntegrationItem 
          title="Sponsored VPS"
          statuses={[
            { icon: <XCircle size={13} className="text-[#ef4444]" />, label: 'Not Activated', colorClass: 'text-[#ef4444]' },
            { label: 'Spent:', value: '0 USD', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' },
            { label: 'Latency:', colorClass: 'text-[color:var(--text-primary)]' }
          ]}
          description="Offer your traders free virtual hosting for round-the-clock trading."
          linkText="More about the service"
        />

        <IntegrationItem 
          title="Mail Servers"
          statuses={[
            { icon: <CheckCircle2 size={13} className="text-[#22c55e]" />, label: 'Used', colorClass: 'text-[#22c55e]' },
            { icon: <AtSign size={13} className="text-[#3b82f6]" />, label: 'Mail accounts:', value: '1', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' },
            { icon: <Server size={13} className="text-[#3b82f6]" />, label: 'Mail servers:', value: '1', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' }
          ]}
          description="Send newsletters and personal emails to your traders."
          linkText="How to set up a mail server"
          chart={{ successVal: 51, failVal: 510, yMax: 500, yMin: 0 }}
        />

        <IntegrationItem 
          title="SMS Gateways"
          statuses={[
            { icon: <CheckCircle2 size={13} className="text-[#22c55e]" />, label: 'Providers:', value: '1', colorClass: 'text-[#22c55e]', valueColor: 'text-[#22c55e]' },
            { label: 'Balance:', value: '11 usd', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[#22c55e]' },
            { label: 'Spent:', value: '0 usd', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[#22c55e]' },
            { label: 'Average Price:', value: '0.00 usd', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[#22c55e]' }
          ]}
          description="Send automatic SMS to verify clients' contact details for newly opened accounts."
          linkText="How to set up SMS verification"
          chart={{ successVal: 0, failVal: 452, yMax: 0, yMin: 0 }}
        />

        <IntegrationItem 
          title="Messenger Channels"
          statuses={[
            { icon: <XCircle size={13} className="text-[#ef4444]" />, label: 'Not configured', colorClass: 'text-[#ef4444]' }
          ]}
          description="Receive platform performance data via messenger channels."
          linkText={
            <span>
              <a href="#" className="hover:underline">How to set up</a> <a href="#" className="hover:underline">Telegram</a>, <a href="#" className="hover:underline">Slack</a> and <a href="#" className="hover:underline">Teams</a>
            </span>
          }
          chart={{ successVal: 0, failVal: 0, yMax: 1, yMin: 0 }}
        />

        <IntegrationItem 
          title="KYC Checks"
          statuses={[
            { icon: <XCircle size={13} className="text-[#ef4444]" />, label: 'Not configured', colorClass: 'text-[#ef4444]' },
            { label: 'Countries:', value: '0', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' },
            { label: 'Groups:', value: '0', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' },
            { label: 'Accounts checked:', value: '0', colorClass: 'text-[color:var(--text-primary)]', valueColor: 'text-[color:var(--text-primary)]' }
          ]}
          description="Automatically check documents when opening live accounts."
          linkText="How to set up KYC checks"
        />

      </div>
    </div>
  );
};

export default IntegrationsView;
