import React from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn';

export const TooltipProvider = ({ children, delayDuration = 200 }) => (
  <RTooltip.Provider delayDuration={delayDuration}>{children}</RTooltip.Provider>
);

export const Tooltip = ({ content, children, side = 'top', className }) => (
  <RTooltip.Root>
    <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
    <RTooltip.Portal>
      <RTooltip.Content
        side={side}
        sideOffset={6}
        className={cn(
          'z-50 px-2 py-1 rounded-[var(--radius-sm)]',
          'bg-[color:var(--text-primary)] text-[color:var(--text-inverse)]',
          'text-[11px] font-medium shadow-[var(--shadow-md)]',
          className
        )}
      >
        {content}
      </RTooltip.Content>
    </RTooltip.Portal>
  </RTooltip.Root>
);
