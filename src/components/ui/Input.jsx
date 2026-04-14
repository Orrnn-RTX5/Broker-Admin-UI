import React from 'react';
import { cn } from '../../lib/cn';

export const Input = React.forwardRef(function Input(
  { className, invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full px-2.5 text-[13px] rounded-[var(--radius-sm)]',
        'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]',
        'border border-[color:var(--border-default)]',
        'transition-colors duration-150',
        'focus:outline-none focus:border-[color:var(--text-primary)]',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-2)]',
        invalid && 'border-[color:var(--danger-500)] focus:border-[color:var(--danger-500)]',
        className
      )}
      {...rest}
    />
  );
});

export const Label = ({ className, children, ...rest }) => (
  <label
    className={cn(
      'text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)] mb-1.5 inline-block',
      className
    )}
    {...rest}
  >
    {children}
  </label>
);
