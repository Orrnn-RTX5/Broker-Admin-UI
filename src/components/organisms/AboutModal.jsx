import { Info, Mail, Monitor, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const BUILD_MODE = import.meta.env.MODE || 'development';
const SUPPORT_EMAIL = 'support@orrnn.com';

const getRuntimeLabel = () => {
  if (typeof window !== 'undefined' && window.rtx5Electron) return 'Electron desktop';
  return 'Web browser';
};

const Detail = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[color:var(--border-subtle)] last:border-b-0">
    <span className="text-[11px] uppercase tracking-wide text-[color:var(--text-muted)]">{label}</span>
    <span className="text-[12px] font-mono text-[color:var(--text-primary)] text-right">{value}</span>
  </div>
);

export const AboutModal = ({ open, onOpenChange }) => (
  <Modal
    open={open}
    onOpenChange={onOpenChange}
    title="About RTX 5"
    description="RTX 5 Admin broker operations terminal."
    size="md"
    footer={(
      <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
        OK
      </Button>
    )}
  >
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)]">
          <Info size={18} className="text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-[color:var(--text-primary)] leading-5">
              RTX 5 Admin
            </h2>
            <Badge tone="info">v{APP_VERSION}</Badge>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-secondary)]">
            Production admin console for broker clients, trading accounts, symbols, orders, positions, and operational controls.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] px-3 py-2">
        <Detail label="Build" value={BUILD_MODE} />
        <Detail label="Runtime" value={getRuntimeLabel()} />
        <Detail label="Vendor" value="Orrnn" />
      </div>

      <div className="grid gap-2 text-[12px] text-[color:var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-white" aria-hidden="true" />
          <span>Secure broker administration workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <Monitor size={13} className="text-[color:var(--text-muted)]" aria-hidden="true" />
          <span>React, Vite, and Electron compatible shell</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail size={13} className="text-[color:var(--text-muted)]" aria-hidden="true" />
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-white hover:text-white underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  </Modal>
);
