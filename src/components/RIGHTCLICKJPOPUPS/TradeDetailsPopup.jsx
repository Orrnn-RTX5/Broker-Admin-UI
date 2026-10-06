import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import AccountTradeControls from './AccountTradeControls.jsx';
import PendingTradeControls from './PendingTradeControls.jsx';
import PositionProtectionControls from './PositionProtectionControls.jsx';
import {useAuthStore} from '../../store/authStore.js';
import {hasPermission,PERMISSION_KEYS} from '../../utils/permissions.js';

const MotionDiv = motion.div;

const TRADE_DETAIL_FIELDS = {
  Orders: [
    ['Ticket', 'ticket'],
    ['Login', 'login'],
    ['Time', 'time'],
    ['Symbol', 'symbol'],
    ['Side', 'side'],
    ['Volume', 'volume'],
    ['Open Price', 'open_price'],
    ['S/L', 'sl'],
    ['T/P', 'tp'],
    ['Status', 'status'],
    ['Comment', 'comment'],
  ],
  Positions: [
    ['Ticket', 'ticket'],
    ['Login', 'login'],
    ['Time', 'time'],
    ['Symbol', 'symbol'],
    ['Side', 'side'],
    ['Volume', 'volume'],
    ['Open Price', 'open_price'],
    ['Current Price', 'current_price'],
    ['S/L', 'sl'],
    ['T/P', 'tp'],
    ['Swap', 'swap'],
    ['Profit', 'profit'],
  ],
  Deals: [
    ['Ticket', 'ticket'],
    ['Order Ticket', 'orderTicker'],
    ['Time', 'time'],
    ['Login', 'login'],
    ['Symbol', 'symbol'],
    ['Action', 'action'],
    ['Entry', 'entry'],
    ['Volume', 'volume'],
    ['Price', 'price'],
    ['Commission', 'commission'],
    ['Fee', 'fee'],
    ['Profit', 'profit'],
  ],
};

const singularTitle = {
  Orders: 'Order',
  Positions: 'Position',
  Deals: 'Deal',
};

const formatValue = (value) => (
  value === undefined || value === null || value === '' ? '-' : String(value)
);

const DetailField = ({ label, value, multiline = false }) => (
  <div className="flex items-start gap-3">
    <label className="w-24 shrink-0 pt-1 text-right text-[12px] text-[color:var(--text-secondary)]">
      {label}:
    </label>
    {multiline ? (
      <textarea
        value={formatValue(value)}
        disabled
        rows={3}
        className="min-h-[64px] flex-1 resize-none rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] px-2 py-1 text-[12px] text-white opacity-80 outline-none"
      />
    ) : (
      <input
        value={formatValue(value)}
        disabled
        className="h-[26px] flex-1 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] px-2 py-1 text-[12px] text-white opacity-80 outline-none"
      />
    )}
  </div>
);

const TradeDetailsPopup = ({ viewType, row, onClose }) => {
  const user=useAuthStore(state=>state.user);
  const fields = TRADE_DETAIL_FIELDS[viewType] || [];
  const title = singularTitle[viewType] || 'Trade';
  const identifier = row?.ticket || row?.id;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="flex max-h-[90vh] w-[560px] flex-col overflow-hidden rounded-[6px] border border-[color:var(--bg-surface-3)] bg-[color:var(--bg-app)] shadow-2xl"
      >
        <div className="flex h-8 shrink-0 select-none items-center justify-between border-b border-white/5 bg-[color:var(--bg-app)] px-3">
          <div className="text-[12px] text-[color:var(--text-primary)]">
            {title} Details {identifier ? `#${identifier}` : ''}
          </div>
          <button
            onClick={onClose}
            className="flex h-[20px] w-[28px] items-center justify-center rounded-tr-[4px] text-[color:var(--text-muted)] transition-colors hover:bg-red-500 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-4 text-[color:var(--text-secondary)] no-scrollbar">
          {fields.map(([label, key]) => (
            <DetailField
              key={key}
              label={label}
              value={row?.[key]}
              multiline={key === 'comment'}
            />
          ))}
          {viewType === 'Positions' && <PositionProtectionControls login={row?.login} ticket={row?.raw?.position_ticket_text ?? row?.raw?.ticket_text ?? identifier} canTrade={hasPermission(user,PERMISSION_KEYS.MANAGE_TRADES)}/> }
          {viewType === 'Positions' && <AccountTradeControls key={identifier} login={row?.login} ticket={row?.raw?.position_ticket_text ?? row?.raw?.ticket_text ?? identifier} />}
          {viewType === 'Orders' && <PendingTradeControls key={identifier} login={row?.login} ticket={row?.raw?.ticket_text ?? row?.raw?.order_ticket_text ?? identifier} />}
        </div>

        <div className="flex h-12 shrink-0 select-none items-center justify-end border-t border-white/5 bg-[color:var(--bg-app)] px-4">
          <button
            onClick={onClose}
            className="h-[24px] rounded border border-[color:var(--border-strong)] bg-transparent px-6 text-[12px] text-white transition-all hover:border-[#777777] hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </MotionDiv>
    </div>
  );
};

export default TradeDetailsPopup;
