import React from 'react';
import * as RCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Checkbox = React.forwardRef(function Checkbox(
  { className, ...rest },
  ref
) {
  return (
    <RCheckbox.Root
      ref={ref}
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded-[3px]',
        'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)]',
        'data-[state=checked]:bg-[color:var(--accent-500)] data-[state=checked]:border-[color:var(--accent-500)]',
        'data-[state=indeterminate]:bg-[color:var(--accent-500)] data-[state=indeterminate]:border-[color:var(--accent-500)]',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-600)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      {...rest}
    >
      <RCheckbox.Indicator className="text-[color:var(--accent-contrast)]">
        {rest.checked === 'indeterminate' ? <Minus size={10} strokeWidth={3} /> : <Check size={10} strokeWidth={3} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
});
