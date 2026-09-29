import React from 'react';
import * as RToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ToastCtx } from './useToast';

/**
 * Lightweight toast. Usage:
 *   <ToastProvider>
 *     <App />
 *     <ToastViewport />
 *   </ToastProvider>
 * Trigger with useToast(): const { notify } = useToast(); notify({ title, tone })
 */

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);
  const notify = React.useCallback((t) => {
    setToasts([{ id: crypto.randomUUID?.() ?? Date.now(), ...t }]);
  }, []);
  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <RToast.Provider swipeDirection="right" duration={4000}>
      <ToastCtx.Provider value={{ notify }}>
        {children}
        {toasts.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className={cn(
              'flex items-start gap-3 p-3 pr-8 w-80 max-w-[calc(100vw-2rem)]',
              'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)]',
              'rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out'
            )}
          >
            {t.tone && (
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: {
                    success: 'var(--success-500)',
                    warning: 'var(--warning-500)',
                    danger:  'var(--danger-500)',
                    info:    'var(--info-500)',
                  }[t.tone] || 'var(--text-muted)',
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              {t.title && (
                <RToast.Title className="text-[11px] font-semibold text-[color:var(--text-primary)]">
                  {t.title}
                </RToast.Title>
              )}
              {t.description && (
                <RToast.Description className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">
                  {t.description}
                </RToast.Description>
              )}
            </div>
            <RToast.Close
              aria-label="Close"
              className="absolute right-2 top-2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            >
              <X size={12} />
            </RToast.Close>
          </RToast.Root>
        ))}
      </ToastCtx.Provider>
    </RToast.Provider>
  );
};

export const ToastViewport = () => (
  <RToast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 outline-none" />
);
