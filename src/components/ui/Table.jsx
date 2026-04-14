import React from 'react';
import { cn } from '../../lib/cn';

export const Table = ({ className, children, ...rest }) => (
  <table className={cn('w-full text-[12px] font-mono border-collapse', className)} {...rest}>
    {children}
  </table>
);

export const THead = ({ className, children, ...rest }) => (
  <thead
    className={cn(
      'bg-[color:var(--bg-surface-2)] text-[10px] uppercase tracking-wider',
      'text-[color:var(--text-muted)]',
      className
    )}
    {...rest}
  >
    {children}
  </thead>
);

export const TR = ({ className, children, ...rest }) => (
  <tr
    className={cn(
      'border-b border-[color:var(--border-subtle)]',
      'hover:bg-[color:var(--bg-surface-2)] transition-colors duration-75',
      className
    )}
    {...rest}
  >
    {children}
  </tr>
);

export const TH = ({ className, align = 'left', children, ...rest }) => (
  <th
    className={cn(
      'font-medium px-3 py-2 border-b border-[color:var(--border-subtle)] whitespace-nowrap',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      className
    )}
    {...rest}
  >
    {children}
  </th>
);

export const TD = ({ className, align = 'left', children, ...rest }) => (
  <td
    className={cn(
      'px-3 py-2 text-[color:var(--text-secondary)] whitespace-nowrap',
      align === 'right' && 'text-right tabular-nums',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      className
    )}
    {...rest}
  >
    {children}
  </td>
);
