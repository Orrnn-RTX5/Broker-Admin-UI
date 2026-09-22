import React from 'react';
import { cn } from '../../lib/cn';

const tones = {
  neutral: 'bg-[color:var(--bg-surface-2)] text-[color:var(--text-secondary)] border-[color:var(--border-default)]',
  success: 'bg-transparent text-[color:var(--success-500)] border-[color:var(--border-default)]',
  warning: 'bg-transparent text-[color:var(--warning-500)] border-[color:var(--border-default)]',
  danger:  'bg-transparent text-[color:var(--danger-500)]  border-[color:var(--border-default)]',
  info:    'bg-transparent text-[color:var(--info-500)]    border-[color:var(--border-default)]',
};

export const Badge = ({ tone = 'neutral', className, children, ...rest }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-1.5 h-5 text-[11px] font-mono tracking-tight',
      'border rounded-[var(--radius-sm)]',
      tones[tone],
      className
    )}
    {...rest}
  >
    {children}
  </span>
);

export const StatusDot = ({ tone = 'neutral', className }) => {
  const color = {
    neutral: 'var(--text-muted)',
    success: 'var(--success-500)',
    warning: 'var(--warning-500)',
    danger:  'var(--danger-500)',
    info:    'var(--info-500)',
  }[tone];
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-full', className)}
      style={{ background: color }}
    />
  );
};
