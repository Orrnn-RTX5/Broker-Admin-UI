import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

const DEFAULT_COLUMNS = [
  { key: 'login', label: 'Login' },
  { key: 'name', label: 'Name' },
  { key: 'group', label: 'Group' },
  { key: 'country', label: 'Country' },
  { key: 'client', label: 'Client' },
  { key: 'balance', label: 'Balance' },
  { key: 'balanceChecked', label: 'Balance / Checked' },
  { key: 'equity', label: 'Equity' },
  { key: 'profit', label: 'Profit' },
  { key: 'currency', label: 'Currency' },
];

const MenuIcon = ({ name, checked }) => {
  switch (name) {
    case 'new-account':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.5V13.5M2.5 8H13.5" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'account-details':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="3.2" width="13" height="10" rx="1.4" fill="#3898ff" />
          <rect x="6.2" y="2" width="3.6" height="2" rx="0.6" fill="#1f1f1f" stroke="#3898ff" strokeWidth="1" />
          <circle cx="5.2" cy="7.1" r="1.35" fill="#e8f3ff" />
          <path d="M3.1 11.4c.35-1.35 1.15-2 2.1-2s1.75.65 2.1 2" stroke="#e8f3ff" strokeWidth="1.15" strokeLinecap="round" />
          <line x1="8.8" y1="6.6" x2="12.7" y2="6.6" stroke="#e8f3ff" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8.8" y1="8.8" x2="12.7" y2="8.8" stroke="#e8f3ff" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8.8" y1="10.9" x2="11.6" y2="10.9" stroke="#e8f3ff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'mail':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.8" y="3.3" width="12.4" height="9.4" rx="1" stroke="#e08e26" strokeWidth="1.25" />
          <path d="M2.2 4.1L8 8.6L13.8 4.1" stroke="#e08e26" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'notification':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2.2a3.7 3.7 0 0 0-3.7 3.7v2.3c0 .9-.38 1.68-1.08 2.18l-.32.22h10.2l-.32-.22A2.68 2.68 0 0 1 11.7 8.2V5.9A3.7 3.7 0 0 0 8 2.2Z"
            stroke="#e08e26"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="M6.6 12.2a1.45 1.45 0 0 0 2.8 0" stroke="#e08e26" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'export':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M12.6 9.2A5.2 5.2 0 1 1 8.8 3" stroke="#22c55e" strokeWidth="1.35" strokeLinecap="round" />
          <path d="M8.5 7.5L13.6 2.4M10.4 2.4H13.6V5.6" stroke="#22c55e" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'import':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M12.6 9.2A5.2 5.2 0 1 1 8.8 3" stroke="#22c55e" strokeWidth="1.35" strokeLinecap="round" />
          <path d="M13.6 2.4L8.5 7.5M11.7 7.5H8.5V4.3" stroke="#22c55e" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'find':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.8" cy="6.8" r="4.3" stroke="#2b99ff" strokeWidth="1.35" />
          <path d="M10.1 10.1L13.8 13.8" stroke="#2b99ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'delete':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'charges':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.1 6.2A5.2 5.2 0 0 1 12.6 5.2" stroke="#2b99ff" strokeWidth="1.25" strokeLinecap="round" />
          <path d="M12.8 2.9V5.4H10.3" stroke="#2b99ff" strokeWidth="1.25" strokeLinecap="round" />
          <path d="M12.9 9.8A5.2 5.2 0 0 1 3.4 10.8" stroke="#2b99ff" strokeWidth="1.25" strokeLinecap="round" />
          <path d="M3.2 13.1V10.6H5.7" stroke="#2b99ff" strokeWidth="1.25" strokeLinecap="round" />
          <path
            d="M8 4.8v6.4M9.4 6.2c0-.65-.63-1-1.4-1-.78 0-1.4.38-1.4.95 0 1.15 2.8.7 2.8 1.9 0 .6-.62.98-1.4.98-.82 0-1.45-.38-1.45-1.02"
            stroke="#2b99ff"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'check-balance':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="5.6" stroke="#22c55e" strokeWidth="1.3" />
          <path d="M5.4 8.1L7.2 9.9L10.8 6.3" stroke="#22c55e" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'fix-balance':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.1" stroke="#2b99ff" strokeWidth="1.25" />
          <path
            d="M6.85 1.8h2.3l.32 1.48c.38.13.73.33 1.04.58l1.43-.48 1.15 1.98-1.11 1c.06.21.09.42.09.64s-.03.43-.09.64l1.11 1-1.15 1.98-1.43-.48c-.31.25-.66.45-1.04.58l-.32 1.48h-2.3l-.32-1.48a4.5 4.5 0 0 1-1.04-.58l-1.43.48-1.15-1.98 1.11-1A3.9 3.9 0 0 1 3.93 8c0-.22.03-.43.09-.64l-1.11-1 1.15-1.98 1.43.48c.31-.25.66-.45 1.04-.58L6.85 1.8Z"
            stroke="#2b99ff"
            strokeWidth="1.15"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'fix-personal-data':
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="4.8" r="2.3" stroke="#2b99ff" strokeWidth="1.3" />
          <path d="M3.4 13.2c.55-2.4 2.2-3.6 4.6-3.6s4.05 1.2 4.6 3.6H3.4Z" stroke="#2b99ff" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    default:
      if (checked) return <Check size={12} strokeWidth={2.4} color="#f4f4f5" aria-hidden="true" />;
      return null;
  }
};

const TradingAccountsContextMenu = ({
  x = 0,
  y = 0,
  selectedRow = null,
  rows = [],
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onExport,
  onCopyAs,
  onFind,
}) => {
  const menuRef = useRef(null);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [hoveredSubKey, setHoveredSubKey] = useState(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoArrange, setAutoArrange] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set());

  useEffect(() => {
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const items = useMemo(() => {
    const hasTarget = Boolean(selectedRow);
    const targetGroup = String(selectedRow?.group || selectedRow?.Group || '').trim();
    const targetCountry = String(selectedRow?.country || selectedRow?.Country || '').trim();

    return [
      {
        key: 'new-account',
        label: 'New Account',
        icon: 'new-account',
        shortcut: 'Ctrl+Shift+N',
        onSelect: () => onAdd?.(),
      },
      {
        key: 'account-details',
        label: 'Account Details',
        icon: 'account-details',
        disabled: !hasTarget,
        onSelect: () => onEdit?.(selectedRow),
      },
      {
        key: 'bulk-operations',
        label: 'Bulk Operations',
        submenu: [
          { key: 'bulk-charges', label: 'Charges', icon: 'charges', disabled: !hasTarget, onSelect: () => onEdit?.(selectedRow) },
          { key: 'bulk-check-balance', label: 'Check Balance', icon: 'check-balance', disabled: !hasTarget, onSelect: () => onEdit?.(selectedRow) },
          { key: 'bulk-fix-balance', label: 'Fix Balance', icon: 'fix-balance', disabled: !hasTarget, onSelect: () => onEdit?.(selectedRow) },
          { key: 'bulk-fix-personal-data', label: 'Fix Personal Data', icon: 'fix-personal-data', disabled: !hasTarget, onSelect: () => onEdit?.(selectedRow) },
        ],
      },
      { divider: true },
      {
        key: 'internal-mail',
        label: 'Internal Mail / Email',
        icon: 'mail',
        disabled: !hasTarget,
        onSelect: () => onEdit?.(selectedRow),
      },
      {
        key: 'push-notification',
        label: 'Push Notification / SMS',
        icon: 'notification',
        disabled: !hasTarget,
        onSelect: () => onEdit?.(selectedRow),
      },
      { divider: true },
      {
        key: 'select-by',
        label: 'Select By',
        submenu: [
          { key: 'select-all', label: `All (${rows.length})`, shortcut: 'Ctrl+A', onSelect: () => {} },
          { key: 'select-group', label: targetGroup ? `Same Group (${targetGroup})` : 'Same Group', disabled: !targetGroup, onSelect: () => {} },
          { key: 'select-country', label: targetCountry ? `Same Country (${targetCountry})` : 'Same Country', disabled: !targetCountry, onSelect: () => {} },
        ],
      },
      {
        key: 'filter',
        label: 'Filter',
        submenu: [
          { key: 'filter-group', label: targetGroup ? `Group: ${targetGroup}` : 'By Group', disabled: !targetGroup, onSelect: () => {} },
          { key: 'filter-country', label: targetCountry ? `Country: ${targetCountry}` : 'By Country', disabled: !targetCountry, onSelect: () => {} },
        ],
      },
      {
        key: 'copy-as',
        label: 'Copy As',
        submenu: [
          { key: 'copy-csv', label: 'CSV', onSelect: () => onCopyAs?.('csv', selectedRow) },
          { key: 'copy-tsv', label: 'TSV (Tab-Separated)', shortcut: 'Ctrl+C', onSelect: () => onCopyAs?.('tsv', selectedRow) },
          { key: 'copy-json', label: 'JSON', onSelect: () => onCopyAs?.('json', selectedRow) },
        ],
      },
      {
        key: 'export',
        label: 'Export',
        icon: 'export',
        onSelect: () => onExport?.(selectedRow),
      },
      {
        key: 'import',
        label: 'Import',
        icon: 'import',
        onSelect: () => {},
      },
      {
        key: 'find',
        label: 'Find',
        icon: 'find',
        shortcut: 'Ctrl+F',
        onSelect: () => onFind?.(),
      },
      { divider: true },
      {
        key: 'delete-accounts',
        label: 'Delete Accounts',
        icon: 'delete',
        shortcut: 'Ctrl+D',
        disabled: !hasTarget || !onDelete,
        onSelect: () => onDelete?.(selectedRow),
      },
      { divider: true },
      {
        key: 'auto-scroll',
        label: 'Auto Scroll',
        checked: autoScroll,
        onSelect: () => setAutoScroll((v) => !v),
      },
      {
        key: 'auto-arrange',
        label: 'Auto Arrange',
        shortcut: 'A',
        checked: autoArrange,
        onSelect: () => setAutoArrange((v) => !v),
      },
      {
        key: 'grid',
        label: 'Grid',
        shortcut: 'G',
        checked: showGrid,
        onSelect: () => setShowGrid((v) => !v),
      },
      { divider: true },
      {
        key: 'columns',
        label: 'Columns',
        submenu: DEFAULT_COLUMNS.map((col) => ({
          key: `col-${col.key}`,
          label: col.label,
          checked: !hiddenColumns.has(col.key),
          onSelect: () => setHiddenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(col.key)) next.delete(col.key);
            else if (next.size < DEFAULT_COLUMNS.length - 1) next.add(col.key);
            return next;
          }),
        })),
      },
    ];
  }, [autoArrange, autoScroll, hiddenColumns, onAdd, onCopyAs, onDelete, onEdit, onExport, onFind, rows.length, selectedRow, showGrid]);

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const menuWidth = 236;
  const estimatedHeight = Math.min(viewportH - 16, items.length * 22 + 16);
  const left = Math.max(4, Math.min(x, viewportW - menuWidth - 8));
  const top = Math.max(4, Math.min(y, viewportH - estimatedHeight - 8));
  const openSubmenuLeft = left + menuWidth + 190 > viewportW;

  const node = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Trading Accounts context menu"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 10000,
        minWidth: `${menuWidth}px`,
        padding: '4px 0',
        background: '#1f1f1f',
        border: '1px solid #6b6b6b',
        borderRadius: '0px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
        color: '#e8e8e8',
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        fontSize: '11px',
        fontWeight: 400,
        lineHeight: '16px',
        userSelect: 'none',
      }}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${idx}`}
              role="separator"
              style={{ height: '1px', margin: '4px 2px', background: '#484848' }}
            />
          );
        }
        const itemKey = item.key || item.label;
        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;
        const isHovered = hoveredKey === itemKey;
        const isDisabled = Boolean(item.disabled);
        return (
          <div
            key={itemKey}
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              setHoveredKey(itemKey);
              setHoveredSubKey(null);
            }}
          >
            <button
              type="button"
              role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={item.checked !== undefined ? Boolean(item.checked) : undefined}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                if (hasSubmenu) {
                  setHoveredKey(itemKey);
                  return;
                }
                item.onSelect?.();
                onClose?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                minHeight: '22px',
                padding: '2px 10px 2px 6px',
                border: 0,
                background: isHovered && !isDisabled ? '#333333' : 'transparent',
                color: isDisabled ? '#7a7a7a' : '#e8e8e8',
                cursor: isDisabled ? 'default' : 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: '11px',
                gap: '12px',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                <span
                  style={{
                    width: '20px',
                    height: '16px',
                    flex: '0 0 20px',
                    marginRight: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MenuIcon name={item.icon} checked={item.checked} />
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
              </span>
              {hasSubmenu ? (
                <svg width="6" height="8" viewBox="0 0 6 8" fill="none" aria-hidden="true">
                  <path d="M1 1L5 4L1 7V1Z" fill="#e8e8e8" />
                </svg>
              ) : item.shortcut ? (
                <span style={{ color: isDisabled ? '#7a7a7a' : '#d0d0d0', fontSize: '11px', marginLeft: '16px' }}>
                  {item.shortcut}
                </span>
              ) : null}
            </button>

            {hasSubmenu && isHovered && (
              <div
                role="menu"
                aria-label={`${item.label} submenu`}
                style={{
                  position: 'absolute',
                  top: '-3px',
                  ...(openSubmenuLeft ? { right: '100%', marginRight: '-1px' } : { left: '100%', marginLeft: '-1px' }),
                  zIndex: 10001,
                  minWidth: '176px',
                  padding: '3px 0',
                  background: '#1f1f1f',
                  border: '1px solid #484848',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
                  color: '#e8e8e8',
                }}
              >
                {item.submenu.map((sub, subIdx) => {
                  if (sub.divider) {
                    return (
                      <div
                        key={`sub-div-${subIdx}`}
                        role="separator"
                        style={{ height: '1px', margin: '3px 2px', background: '#383838' }}
                      />
                    );
                  }
                  const subKey = sub.key || sub.label;
                  const subHovered = hoveredSubKey === subKey;
                  const subDisabled = Boolean(sub.disabled);
                  return (
                    <button
                      key={subKey}
                      type="button"
                      role={sub.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
                      aria-checked={sub.checked !== undefined ? Boolean(sub.checked) : undefined}
                      disabled={subDisabled}
                      onMouseEnter={() => setHoveredSubKey(subKey)}
                      onClick={() => {
                        if (subDisabled) return;
                        sub.onSelect?.();
                        onClose?.();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        minHeight: '22px',
                        padding: '2px 10px 2px 6px',
                        border: 0,
                        background: subHovered && !subDisabled ? '#333333' : 'transparent',
                        color: subDisabled ? '#7a7a7a' : '#e8e8e8',
                        cursor: subDisabled ? 'default' : 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: '11px',
                        gap: '10px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <span
                          style={{
                            width: '20px',
                            height: '16px',
                            flex: '0 0 20px',
                            marginRight: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MenuIcon name={sub.icon} checked={sub.checked} />
                        </span>
                        <span style={{ whiteSpace: 'nowrap' }}>{sub.label}</span>
                      </span>
                      {sub.shortcut && <span style={{ color: '#d0d0d0', fontSize: '11px' }}>{sub.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(node, document.getElementById('root') || document.body);
  }
  return node;
};

export default TradingAccountsContextMenu;
