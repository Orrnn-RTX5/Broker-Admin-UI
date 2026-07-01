import React from 'react';
import { cn } from '../../lib/cn';

export const Table = ({ className, children, ...rest }) => (
  <table className={cn('w-full text-[12px] font-mono border-separate border-spacing-0', className)} {...rest}>
    {children}
  </table>
);

export const THead = ({ className, children, ...rest }) => (
  <thead
    className={cn(
      'sticky top-0 z-10 bg-[color:var(--bg-surface-2)] text-[10px] uppercase tracking-wider',
      'text-[color:var(--text-secondary)]',
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
      'even:bg-[color:var(--bg-surface-2)]/45 hover:bg-[color:var(--bg-surface-3)] transition-colors duration-75',
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
      'font-semibold px-3 py-2 border-b border-[color:var(--border-strong)] whitespace-nowrap',
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
      'h-[var(--row-h)] px-3 py-[var(--row-py)] text-[color:var(--text-primary)] whitespace-nowrap',
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
