import React from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn';

export const Tabs = (props) => <RTabs.Root {...props} />;

export const TabsList = React.forwardRef(function TabsList({ className, ...rest }, ref) {
  return (
    <RTabs.List
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center gap-0 border-b border-[color:var(--border-subtle)] w-full',
        className
      )}
      {...rest}
    />
  );
});

export const TabsTrigger = React.forwardRef(function TabsTrigger({ className, ...rest }, ref) {
  return (
    <RTabs.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center h-8 px-3 text-[12px] font-medium',
        'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]',
        'border-b-2 border-transparent -mb-px transition-colors duration-150',
        'data-[state=active]:text-[color:var(--text-primary)]',
        'data-[state=active]:border-[color:var(--text-primary)]',
        'focus-visible:outline-none',
        className
      )}
      {...rest}
    />
  );
});

export const TabsContent = React.forwardRef(function TabsContent(props, ref) {
  return <RTabs.Content ref={ref} {...props} />;
});
