import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Chrome-style tab bar. Each tab is an open viewType. Click to switch,
 * X to close. Sits between the breadcrumb and the data area.
 */
export const TabBar = ({ tabs, activeTab, onSelect, onClose }) => {
  const scrollRef = React.useRef(null);
  const tabRefs = React.useRef(new Map());
  const [scrollState, setScrollState] = React.useState({ left: false, right: false });

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setScrollState({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  const scrollTabs = React.useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(240, Math.floor(el.clientWidth * 0.65)), behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [tabs?.length, updateScrollState]);

  React.useEffect(() => {
    const activeNode = tabRefs.current.get(activeTab);
    activeNode?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    window.requestAnimationFrame(updateScrollState);
  }, [activeTab, tabs?.length, updateScrollState]);

  if (!tabs || tabs.length === 0) return null;

  const handleTabKeyDown = (event, tab, index) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(tab);
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && tabs.length > 1) {
      event.preventDefault();
      onClose(tab);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
      onSelect(nextTab);
    }
  };

  return (
    <div className="flex h-8 shrink-0 items-stretch bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-subtle)]">
      {tabs.length > 1 && (
        <button
          type="button"
          aria-label="Scroll tabs left"
          onClick={() => scrollTabs(-1)}
          disabled={!scrollState.left}
          className="w-7 shrink-0 border-r border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-1)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <ChevronLeft size={13} className="mx-auto" aria-hidden="true" />
        </button>
      )}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Open views"
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto no-scrollbar scroll-smooth"
      >
        {tabs.map((t, index) => {
          const active = t === activeTab;
          return (
            <div
              key={t}
              ref={(node) => {
                if (node) tabRefs.current.set(t, node);
                else tabRefs.current.delete(t);
              }}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={t}
              onClick={() => onSelect(t)}
              onKeyDown={(event) => handleTabKeyDown(event, t, index)}
              className={cn(
                'group relative flex h-full min-w-[104px] max-w-[180px] items-center gap-1.5 border-r border-[color:var(--border-subtle)] px-2.5 text-[12px] outline-none select-none cursor-default',
                'focus-visible:bg-[color:var(--bg-surface-1)] focus-visible:text-[color:var(--text-primary)]',
                active
                  ? 'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)] font-medium shadow-[inset_0_-2px_0_var(--accent-500)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-1)] hover:text-[color:var(--text-primary)]'
              )}
            >
              <span className="min-w-0 flex-1 truncate leading-none">{t}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClose(t); }}
                  aria-label={`Close ${t}`}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[color:var(--text-muted)] hover:bg-[color:var(--bg-surface-3)] hover:text-[color:var(--text-primary)] focus:opacity-100 focus:outline-none',
                    active ? 'opacity-100' : 'opacity-55 md:opacity-0 md:group-hover:opacity-100'
                  )}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {tabs.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => scrollTabs(1)}
            disabled={!scrollState.right}
            className="w-7 shrink-0 border-l border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-1)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <ChevronRight size={13} className="mx-auto" aria-hidden="true" />
          </button>
          <div
            className="hidden w-10 shrink-0 items-center justify-center border-l border-[color:var(--border-subtle)] font-mono text-[10px] text-[color:var(--text-muted)] sm:flex"
            title={`${tabs.length} open tabs`}
          >
            {tabs.length}
          </div>
        </>
      )}
    </div>
  );
};
