import React from 'react';
import { cn } from '../../lib/cn';

export const Input = React.forwardRef(function Input(
  { className, invalid, 'aria-invalid': ariaInvalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid ? true : ariaInvalid}
      className={cn(
        'h-9 w-full px-3 text-[11px] font-normal rounded-[var(--radius-sm)]',
        'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-placeholder)]',
        'border border-[color:var(--border-strong)] shadow-[var(--shadow-sm)]',
        'transition-[background-color,border-color,box-shadow] duration-150',
        'focus:outline-none focus:border-[color:var(--accent-500)] focus:ring-2 focus:ring-[color:var(--accent-500)]/20',
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
      'text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1.5 inline-block',
      className
    )}
    {...rest}
  >
    {children}
  </label>
);
