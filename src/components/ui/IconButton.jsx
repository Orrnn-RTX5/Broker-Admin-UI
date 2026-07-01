import React from 'react';
import { cn } from '../../lib/cn';

const sizes = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
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
        'hover:bg-[color:var(--bg-surface-3)] transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-500)]',
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
