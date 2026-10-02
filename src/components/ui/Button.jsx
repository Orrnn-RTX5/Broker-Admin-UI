import React from 'react';
import { cn } from '../../lib/cn';

const variants = {
  primary:
    'bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] font-semibold hover:bg-[color:var(--accent-600)] active:bg-[color:var(--accent-700)] border border-[color:var(--accent-500)] shadow-[var(--shadow-sm)]',
  secondary:
    'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)] shadow-[var(--shadow-sm)]',
  ghost:
    'bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] border border-transparent',
  danger:
    'bg-[color:var(--bg-surface-1)] text-[color:var(--danger-500)] hover:bg-[color:var(--bg-surface-3)] border border-[color:var(--border-strong)]',
};

const sizes = {
  sm: 'h-8 px-3 text-[11px] rounded-[var(--radius-sm)] gap-1.5',
  md: 'h-9 px-3.5 text-[11px] rounded-[var(--radius-sm)] gap-1.5',
  lg: 'h-10 px-4 text-[12px] rounded-[var(--radius-md)] gap-2',
};

export const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', className, leftIcon, rightIcon, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-normal tracking-tight',
        'transition-[background-color,border-color,color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-app)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
