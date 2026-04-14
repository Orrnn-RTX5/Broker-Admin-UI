import React from 'react';
import * as RDropdown from '@radix-ui/react-dropdown-menu';
import * as RContext from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

const contentCls = cn(
  'z-50 min-w-[180px] overflow-hidden',
  'bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)]',
  'rounded-[var(--radius-sm)] shadow-[var(--shadow-md)] p-1'
);

const itemCls = cn(
  'relative flex items-center gap-2 h-7 px-2 text-[12px] rounded-[var(--radius-sm)]',
  'text-[color:var(--text-primary)] cursor-default select-none outline-none',
  'data-[highlighted]:bg-[color:var(--bg-surface-2)]',
  'data-[disabled]:text-[color:var(--text-muted)] data-[disabled]:pointer-events-none'
);

const separatorCls = 'h-px my-1 bg-[color:var(--border-subtle)]';
const labelCls = 'px-2 py-1 text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]';
const shortcutCls = 'ml-auto pl-3 text-[11px] font-mono text-[color:var(--text-muted)]';

/* Dropdown (click-triggered) */
export const DropdownMenu = RDropdown.Root;
export const DropdownMenuTrigger = RDropdown.Trigger;
export const DropdownMenuContent = ({ className, sideOffset = 4, ...rest }) => (
  <RDropdown.Portal>
    <RDropdown.Content sideOffset={sideOffset} className={cn(contentCls, className)} {...rest} />
  </RDropdown.Portal>
);
export const DropdownMenuItem = ({ className, shortcut, children, ...rest }) => (
  <RDropdown.Item className={cn(itemCls, className)} {...rest}>
    {children}
    {shortcut && <span className={shortcutCls}>{shortcut}</span>}
  </RDropdown.Item>
);
export const DropdownMenuLabel = ({ className, ...rest }) => (
  <RDropdown.Label className={cn(labelCls, className)} {...rest} />
);
export const DropdownMenuSeparator = ({ className, ...rest }) => (
  <RDropdown.Separator className={cn(separatorCls, className)} {...rest} />
);
export const DropdownMenuSub = RDropdown.Sub;
export const DropdownMenuSubTrigger = ({ className, children, ...rest }) => (
  <RDropdown.SubTrigger className={cn(itemCls, className)} {...rest}>
    {children}
    <ChevronRight size={12} className="ml-auto text-[color:var(--text-muted)]" />
  </RDropdown.SubTrigger>
);
export const DropdownMenuSubContent = ({ className, ...rest }) => (
  <RDropdown.Portal>
    <RDropdown.SubContent className={cn(contentCls, className)} {...rest} />
  </RDropdown.Portal>
);
export const DropdownMenuCheckboxItem = ({ className, shortcut, children, ...rest }) => (
  <RDropdown.CheckboxItem className={cn(itemCls, 'pl-7', className)} {...rest}>
    <RDropdown.ItemIndicator className="absolute left-2 inline-flex items-center">
      <span className="text-[color:var(--text-primary)]">✓</span>
    </RDropdown.ItemIndicator>
    {children}
    {shortcut && <span className={shortcutCls}>{shortcut}</span>}
  </RDropdown.CheckboxItem>
);

/* Context menu (right-click) */
export const ContextMenu = RContext.Root;
export const ContextMenuTrigger = RContext.Trigger;
export const ContextMenuContent = ({ className, ...rest }) => (
  <RContext.Portal>
    <RContext.Content className={cn(contentCls, className)} {...rest} />
  </RContext.Portal>
);
export const ContextMenuItem = ({ className, shortcut, children, ...rest }) => (
  <RContext.Item className={cn(itemCls, className)} {...rest}>
    {children}
    {shortcut && <span className={shortcutCls}>{shortcut}</span>}
  </RContext.Item>
);
export const ContextMenuLabel = ({ className, ...rest }) => (
  <RContext.Label className={cn(labelCls, className)} {...rest} />
);
export const ContextMenuSeparator = ({ className, ...rest }) => (
  <RContext.Separator className={cn(separatorCls, className)} {...rest} />
);
export const ContextMenuSub = RContext.Sub;
export const ContextMenuSubTrigger = ({ className, children, ...rest }) => (
  <RContext.SubTrigger className={cn(itemCls, className)} {...rest}>
    {children}
    <ChevronRight size={12} className="ml-auto text-[color:var(--text-muted)]" />
  </RContext.SubTrigger>
);
export const ContextMenuSubContent = ({ className, ...rest }) => (
  <RContext.Portal>
    <RContext.SubContent className={cn(contentCls, className)} {...rest} />
  </RContext.Portal>
);
