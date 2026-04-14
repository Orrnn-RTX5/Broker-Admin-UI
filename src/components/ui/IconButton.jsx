import React from 'react';
import { cn } from '../../lib/cn';

const sizes = {
  sm: 'h-6 w-6',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
};

export const IconButton = React.forwardRef(function IconButton(
  { size = 'md', className, children, 'aria-label': ariaLabel, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-sm)]',
        'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
        'hover:bg-[color:var(--bg-surface-2)] transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--text-primary)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
