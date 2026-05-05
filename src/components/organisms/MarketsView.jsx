import React, { useState } from 'react';
import { BarChart2, Settings2 } from 'lucide-react';

import SymbolManagementPage from './SymbolManagement/SymbolManagementPage';
import SymbolsOverviewPage from './SymbolManagement/SymbolsOverviewPage';
import SymbolListPage from './SymbolManagement/SymbolListPage';

const MarketsView = () => {
  const [activeMainTab, setActiveMainTab] = useState('browser');
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden text-[color:var(--text-primary)]">

      {/* Main Tabs (Symbols Browser / Symbol Management) */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-black/40 shrink-0 bg-[color:var(--bg-surface-2)]">
        <button
          onClick={() => { setActiveMainTab('browser'); }}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-[13px] rounded-t-md transition-colors relative mb-[-1px] border border-b-0 ${
            activeMainTab === 'browser'
              ? 'bg-[color:var(--bg-app)] text-[#3b82f6] border-black/40 z-10'
              : 'bg-transparent text-[color:var(--text-muted)] border-transparent hover:text-white hover:bg-white/5'
          }`}
          style={{ borderBottomColor: activeMainTab === 'browser' ? 'var(--bg-app)' : 'transparent' }}
        >
          <BarChart2 size={15} />
          Symbols Browser
        </button>
        <button
          onClick={() => setActiveMainTab('management')}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-[13px] rounded-t-md transition-colors relative mb-[-1px] border border-b-0 ${
            activeMainTab === 'management'
              ? 'bg-[color:var(--bg-app)] text-[#3b82f6] border-black/40 z-10'
              : 'bg-transparent text-[color:var(--text-muted)] border-transparent hover:text-white hover:bg-white/5'
          }`}
          style={{ borderBottomColor: activeMainTab === 'management' ? 'var(--bg-app)' : 'transparent' }}
        >
          <Settings2 size={15} />
          Symbol Management
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeMainTab === 'browser' && (
          <div className="flex-1 w-full h-full overflow-hidden">
            {selectedCategory ? (
              <SymbolListPage
                group={selectedCategory}
                onBack={() => setSelectedCategory(null)}
              />
            ) : (
              <SymbolsOverviewPage onSelectCategory={setSelectedCategory} />
            )}
          </div>
        )}

        {activeMainTab === 'management' && (
          <div className="flex-1 w-full h-full overflow-hidden">
            <SymbolManagementPage />
          </div>
        )}
      </div>

    </div>
  );
};

export default MarketsView;
