import React from 'react';
import * as RSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Select = ({ value, onValueChange, placeholder, options = [], className, disabled }) => (
  <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <RSelect.Trigger
      className={cn(
        'inline-flex items-center justify-between gap-2 h-8 px-2.5 w-full',
        'text-[13px] rounded-[var(--radius-sm)]',
        'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)]',
        'border border-[color:var(--border-default)]',
        'hover:bg-[color:var(--bg-surface-2)] transition-colors duration-150',
        'focus:outline-none focus:border-[color:var(--text-primary)]',
        'data-[placeholder]:text-[color:var(--text-muted)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
    >
      <RSelect.Value placeholder={placeholder} />
      <RSelect.Icon><ChevronDown size={12} className="text-[color:var(--text-muted)]" /></RSelect.Icon>
    </RSelect.Trigger>
    <RSelect.Portal>
      <RSelect.Content
        position="popper"
        sideOffset={4}
        className={cn(
          'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)]',
          'rounded-[var(--radius-sm)] shadow-[var(--shadow-md)]'
        )}
      >
        <RSelect.Viewport className="p-1">
          {options.map((opt) => (
            <RSelect.Item
              key={opt.value}
              value={opt.value}
              className={cn(
                'relative flex items-center h-7 px-2 pr-7 text-[13px] rounded-[var(--radius-sm)]',
                'text-[color:var(--text-primary)] cursor-default select-none',
                'data-[highlighted]:bg-[color:var(--bg-surface-2)] data-[highlighted]:outline-none'
              )}
            >
              <RSelect.ItemText>{opt.label}</RSelect.ItemText>
              <RSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
                <Check size={12} />
              </RSelect.ItemIndicator>
            </RSelect.Item>
          ))}
        </RSelect.Viewport>
      </RSelect.Content>
    </RSelect.Portal>
  </RSelect.Root>
);
