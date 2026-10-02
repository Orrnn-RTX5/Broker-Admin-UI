import React from 'react';
import { cn } from '../../lib/cn';

export const Card = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)]',
      'rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'px-4 py-3 border-b border-[color:var(--border-default)] flex items-center justify-between',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...rest }) => (
  <h3
    className={cn(
      'text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-primary)]',
      className
    )}
    {...rest}
  >
    {children}
  </h3>
);

export const CardBody = ({ className, children, ...rest }) => (
  <div className={cn('p-4', className)} {...rest}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'px-4 py-2.5 border-t border-[color:var(--border-default)] flex items-center justify-end gap-2',
      'bg-[color:var(--bg-surface-2)]',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);
