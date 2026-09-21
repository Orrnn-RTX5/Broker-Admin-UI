import { Modal } from '../ui/Modal';

const shortcuts = [
  { key: 'Ctrl + R',      desc: 'Refresh current view' },
  { key: 'Ctrl + E',      desc: 'Export current view (JSON)' },
  { key: 'Ctrl + Shift+E', desc: 'Export current view (CSV)' },
  { key: 'Ctrl + F',      desc: 'Focus search' },
  { key: 'Ctrl + K',      desc: 'Focus search (alt)' },
  { key: 'Alt + ←',       desc: 'Navigate back' },
  { key: 'Alt + →',       desc: 'Navigate forward' },
  { key: 'Esc',           desc: 'Close open popup / clear search' },
  { key: '?',             desc: 'Show this help' },
];

const Kbd = ({ children }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded-[var(--radius-sm)] bg-[color:var(--bg-surface-2)] border border-[color:var(--border-default)] text-[11px] font-mono text-[color:var(--text-primary)]">
    {children}
  </kbd>
);

export const HelpModal = ({ open, onOpenChange }) => (
  <Modal
    open={open}
    onOpenChange={onOpenChange}
    title="Keyboard shortcuts"
    description="Press ? anywhere to reopen this."
    size="lg"
  >
    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
      {shortcuts.map((s) => (
        <div key={s.key} className="flex items-center justify-between py-1">
          <span className="text-[12px] text-[color:var(--text-secondary)]">{s.desc}</span>
          <Kbd>{s.key}</Kbd>
        </div>
      ))}
    </div>
  </Modal>
);
