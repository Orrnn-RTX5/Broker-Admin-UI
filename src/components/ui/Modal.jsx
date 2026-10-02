import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Modal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) => {
  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-3xl',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color:var(--bg-overlay)]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden',
            'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)]',
            'rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] focus:outline-none',
            widths[size],
            className
          )}
        >
          {(title || description) && (
            <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 pb-3 pr-12 pt-4">
              {title && (
                <Dialog.Title className="text-[13px] font-semibold text-[color:var(--text-primary)] tracking-tight">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="mt-1 text-[11px] font-normal text-[color:var(--text-secondary)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}
          <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-b-[var(--radius-md)] border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] px-5 py-3">
              {footer}
            </div>
          )}
          <Dialog.Close
            aria-label="Close"
            className="absolute right-3 top-3 rounded-[var(--radius-sm)] p-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-surface-2)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-600)]"
          >
            <X size={14} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
