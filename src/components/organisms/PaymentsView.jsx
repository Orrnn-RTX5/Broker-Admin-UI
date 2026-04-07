import React from 'react';
import { Search, Globe, AtSign, Phone, Eye, Folder, Tag, Plug, Link } from 'lucide-react';

const providers = [
  {
    id: 1,
    name: 'Ecommpay',
    logo: (
      <div className="flex items-center text-[#2185D0] font-bold text-lg italic tracking-tighter">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
          <path d="M5 12l5-5 10 10" />
          <path d="M5 12l5 5 10-10" />
        </svg>
        ecommpay
      </div>
    ),
    website: 'ecommpay.com',
    email: 'mnekrasova@ecommpay.com',
    phone: '+35799621260',
    stats: { views: 191, folders: 14, tags: 199 },
    description: 'ECOMPAY is a comprehensive fintech ecosystem that enables global online payments and payouts. We are not just a payment service provider; we are your business partner, offering tailored payment technologies based on data analysis and guiding you through the rapidly changing e-commerce landscape. No irrational decisions or one-size-fits-all technologies...',
  },
  {
    id: 2,
    name: 'Advanced Payment Solutions',
    logo: (
      <div className="flex flex-col items-center justify-center text-[#21BA45] font-bold tracking-tighter w-24">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l10 10-10 10L2 12 12 2z" />
          <path d="M12 8l4 4-4 4-4-4 4-4z" />
        </svg>
        aps
      </div>
    ),
    website: 'lp.aps.money',
    email: 'sales-pd@aps.money',
    phone: '+35725580734',
    stats: { views: 206, folders: 12, tags: 2 },
    description: 'Advanced Payment Solutions (APS) empowers businesses globally with online and corporate payment solutions. As a leading Payment Service Provider (PSP), we offer a turnkey payment processing solution tailored to elevate your online business. We built our products and software solutions on the Stellar Blockchain Open Network, ensuring performance reliability...',
  },
  {
    id: 3,
    name: 'Bitronum Ltd',
    logo: (
      <div className="flex flex-col items-center justify-center text-[#DB2828] font-bold text-[10px] w-24">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#F2711C] mb-1">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        EUPaymentz.com
      </div>
    ),
    website: 'www.eupaymentz.com',
    email: 'info@eupaymentz.com',
    phone: '+441244941125',
    stats: { views: 90, folders: 12, tags: 198 },
    description: 'EUPaymentz is an authorized partner of MetaQuotes and a preferred payment service provider of MetaTrader 5 Payments. Our latest Bitronum payment technology combines advanced encryption and security with some of the fastest deposit and withdrawal rates in the industry. This technology has enabled brokers to accept more deposits and maintain higher account balances. Traders also benefit from our new blockchain platform, which allows for easy deposits a...',
  },
  {
    id: 4,
    name: 'Unlimit',
    logo: (
      <div className="flex flex-col items-center justify-center bg-white text-black font-bold h-16 w-24 px-1">
        <div className="text-lg leading-tight">Unlimit</div>
        <div className="text-[7px] leading-tight text-center">borderless<br/>payments</div>
      </div>
    ),
    website: 'unlimit.com',
    email: 'sales@unlimit.com',
    phone: '+35725388616',
    stats: { views: 177, folders: 19, tags: 198 },
    description: 'Unlimit is a global fintech company that was established in the year 2009. The company offers an extensive range of financial services such as payment processing, global accounts, card issuing, banking as a service (BaaS), and an on-ramp fiat solution for crypto, DeFi, and GameFi. The primary objective of Unlimit is to provide solutions that eradicate financial barriers, enabling businesses to operate seamlessly both locally and internationally across Europe, the UK,...',
  },
  {
    id: 5,
    name: 'Kora',
    logo: (
      <div className="flex items-center justify-center bg-white text-black font-bold h-16 w-24 px-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2185D0" strokeWidth="3" className="mr-1">
          <path d="M4 4h4v16H4zM16 4h4v16h-4zM10 10l6-6v20l-6-6" />
        </svg>
        <span className="text-lg">kora</span>
      </div>
    ),
    website: 'www.korahq.com',
    email: 'support@korapay.com',
    phone: '+2347005672729',
    stats: { views: 4, folders: 3, tags: 3 },
    description: 'Kora is a Pan-African payment infrastructure offering payment solutions in Nigeria, Kenya, Ghana and South Africa. With this integration, you can provide the possibility for your traders to top up accounts using cards and bank transfers. In addition, the system provides mobile payment options for Kenya and Ghana. Kora offers a reliable payment solution to help expand your business in Africa....',
  },
  {
    id: 6,
    name: 'emerchantpay',
    logo: (
      <div className="flex items-center justify-center text-[#00B5AD] font-bold h-16 w-24">
        emerchantpay
      </div>
    ),
    website: 'emerchantpay.com',
    email: 'sales@emerchantpay.com',
    phone: '+442038085888',
    stats: { views: 10, folders: 5, tags: 25 },
    description: 'emerchantpay is a leading global payment service provider for online, mobile, in-store and over the phone payments. Our global payments solution is available through a simple integration, offering a wealth of features, including global acquiring, alternative payment methods, fraud and risk management and performance optimisation...',
  }
];

const PaymentsView = () => {
  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden text-[#e1e1e1]">
      {/* Header Area */}
      <div className="flex justify-between items-start px-6 py-5 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-[16px] font-semibold text-white mb-1">Payment Service Providers</h1>
          <p className="text-[12px] text-[#aaaaaa]">Select the required payment providers for your traders and activate them inside MetaTrader 5 terminal</p>
        </div>
        <div className="flex border border-[#555555] bg-[#111111] h-7 items-center w-64 px-2 rounded-sm focus-within:border-[#3B82F6] transition-colors">
          <input 
            type="text" 
            placeholder="Search" 
            className="bg-transparent border-none outline-none w-full text-[12px] text-white placeholder:text-[#666666]" 
          />
          <Search size={14} className="text-[#3B82F6]" />
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {providers.map((provider, idx) => (
          <div key={provider.id} className="flex px-6 py-6 border-b border-black/40 hover:bg-white/5 transition-colors relative group">
            
            {/* Action Button - Top Right */}
            <div className="absolute top-6 right-6">
              <button className="flex items-center gap-1.5 px-3 h-7 bg-transparent border border-[#555555] rounded text-[11px] text-[#21BA45] hover:border-[#21BA45] hover:bg-[#21BA45]/10 transition-all font-medium">
                <Link size={12} className="rotate-45" />
                Connect Provider
              </button>
            </div>

            {/* Logo Col */}
            <div className="w-[140px] pt-1 shrink-0 flex justify-center">
              {provider.logo}
            </div>

            {/* Content Col */}
            <div className="flex-1 pr-32">
              <h2 className="text-[18px] text-white font-medium mb-3">{provider.name}</h2>
              
              <div className="flex flex-wrap items-center gap-5 text-[11px] text-[#4ea0e9] mb-4">
                <a href="#" className="flex items-center gap-1.5 hover:underline">
                  <Globe size={11} className="text-[#aaaaaa] shrink-0" />
                  {provider.website}
                </a>
                <a href="#" className="flex items-center gap-1.5 hover:underline">
                  <AtSign size={11} className="text-[#aaaaaa] shrink-0" />
                  {provider.email}
                </a>
                <span className="flex items-center gap-1.5">
                  <Phone size={11} className="text-[#aaaaaa] shrink-0" />
                  {provider.phone}
                </span>

                <div className="flex items-center gap-4 ml-2 text-[#cccccc]">
                  <span className="flex items-center gap-1.5" title="Views">
                    <Eye size={11} className="text-[#aaaaaa]" />
                    {provider.stats.views}
                  </span>
                  <span className="flex items-center gap-1.5" title="Folders">
                    <Folder size={11} className="text-[#aaaaaa]" />
                    {provider.stats.folders}
                  </span>
                  <span className="flex items-center gap-1.5" title="Tags">
                    <Tag size={11} className="text-[#aaaaaa]" />
                    {provider.stats.tags}
                  </span>
                </div>
              </div>

              <p className="text-[12px] text-[#aaaaaa] leading-[1.6]">
                {provider.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentsView;
