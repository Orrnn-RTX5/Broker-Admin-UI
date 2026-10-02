import { useId, useState } from 'react';
import SymbolsTab from './SymbolsTab';
import CategoriesTab from './CategoriesTab';
import LpMappingsTab from './LpMappingsTab';
import SessionsTab from './SessionsTab';
import CommissionSwapTab from './CommissionSwapTab';
import AdvancedTab from './AdvancedTab';
import './SymbolWorkspace.css';

const TABS = [
  { id: 'symbols', label: 'Symbols' },
  { id: 'categories', label: 'Categories' },
  { id: 'mappings', label: 'LP Mappings' },
  { id: 'sessions', label: 'Trading Sessions' },
  { id: 'commission', label: 'Commission & Swap' },
  { id: 'advanced', label: 'Advanced' },
];

const SymbolManagementPage = () => {
  const [activeTab, setActiveTab] = useState('symbols');
  const tabsId = useId();

  return (
    <div className="symbol-management-page">
      <header className="symbols-page-header">
        <div className="symbols-page-heading">
          <h1>Symbol Management</h1>
          <p>
            Configure instruments, categories, LP mappings, sessions, commissions, and visibility.
          </p>
        </div>
      </header>

      <div className="symbol-management-tabs" role="tablist" aria-label="Symbol management">
        {TABS.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${tabsId}-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`${tabsId}-panel`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            className="symbol-management-tab"
            onKeyDown={(event) => {
              let next;
              if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
              else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = TABS.length - 1;
              else return;
              event.preventDefault();
              setActiveTab(TABS[next].id);
              event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="symbol-management-content" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${activeTab}`} tabIndex={0}>
        {activeTab === 'symbols'    && <SymbolsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'mappings'   && <LpMappingsTab />}
        {activeTab === 'sessions'   && <SessionsTab />}
        {activeTab === 'commission' && <CommissionSwapTab />}
        {activeTab === 'advanced'   && <AdvancedTab />}
      </div>
    </div>
  );
};

export default SymbolManagementPage;
