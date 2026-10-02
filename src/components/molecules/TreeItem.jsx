import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Folder, File, LockKeyhole } from 'lucide-react';
import { cn } from '../../lib/cn';

const TreeItem = ({ item, level = 0, onSelect, onDoubleClick, selectedLabel, selectedId, onExpandedChange, expanded, refreshTrigger, groupExplorerReveal }) => {
  const [expansion, setExpansion] = useState({ open: Boolean(item.initiallyExpanded), revealedAt: null, hasOpened: Boolean(item.initiallyExpanded) });
  const groupId = useId();
  const rowRef = useRef(null);
  const hasChildren = Boolean(item.children?.length || item.renderChildren);
  const showArrow = hasChildren || item.lockedDropdown;
  const isBlockedNavigation = Boolean(item.blockedNavigation || item.lockedDropdown || item.disabled);
  const isActive = !isBlockedNavigation && (selectedId ? selectedId === item.id : selectedLabel === item.label);
  const Icon = item.icon || (hasChildren ? Folder : File);
  const isGroupFolder = ['groups-root', 'groups-admin', 'group', 'dummy-folder', 'server-folder'].includes(item.type);
  const revealRevision = groupExplorerReveal && (
    item.containsGroups
    || item.type === 'groups-root'
    || (item.type === 'groups-admin' && groupExplorerReveal.type !== 'root')
    || (item.type === 'dummy-folder' && groupExplorerReveal.type === 'dummy-folder' && (
      groupExplorerReveal.path === item.path || groupExplorerReveal.path?.startsWith(`${item.path}\\`)
    ))
    || (item.type === 'server-folder' && (
      (groupExplorerReveal.type === 'server-folder' && (
        groupExplorerReveal.path === item.path || groupExplorerReveal.path?.startsWith(`${item.path}\\`)
      ))
      || (groupExplorerReveal.type === 'group' && groupExplorerReveal.groupName?.startsWith(`${item.path}\\`))
    ))
    || (item.type === 'group' && groupExplorerReveal.type === 'group' && (
      groupExplorerReveal.id === item.id || groupExplorerReveal.groupName === item.groupName
    ))
  ) ? groupExplorerReveal.revision : null;
  const shouldReveal = expanded === undefined && !isBlockedNavigation && revealRevision !== null && revealRevision !== expansion.revealedAt;
  const isOpen = shouldReveal || (expanded ?? expansion.open);

  // A navigation event opens its ancestors once. Remember the event so a later
  // chevron click can still collapse the folder until the next navigation.
  if (shouldReveal || (isOpen && !expansion.hasOpened)) {
    setExpansion({
      open: shouldReveal || expansion.open,
      revealedAt: shouldReveal ? revealRevision : expansion.revealedAt,
      hasOpened: true,
    });
  }

  useEffect(() => {
    if (groupExplorerReveal?.id && groupExplorerReveal.id === item.id && selectedId === item.id) {
      rowRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }, [groupExplorerReveal?.id, groupExplorerReveal?.revision, item.id, selectedId]);

  const setOpen = (next) => {
    setExpansion(previous => ({ ...previous, open: next, hasOpened: previous.hasOpened || next }));
    onExpandedChange?.(next);
  };

  const toggleOpen = () => {
    setOpen(!isOpen);
  };

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (isBlockedNavigation) return;
    if (hasChildren) toggleOpen();
  };

  const handleRowClick = () => {
    if (isBlockedNavigation) return;
    if (hasChildren && !item.lockedDropdown) {
      if (isGroupFolder) setOpen(true);
      else toggleOpen();
    }

    if (!item.navigationOnly) onSelect && onSelect(item);
  };

  const handleRowDoubleClick = () => {
    if (isBlockedNavigation) return;
    if (isGroupFolder) {
      setOpen(true);
      onSelect?.(item);
      return;
    }
    onDoubleClick?.(item);
  };

  const handleRowKeyDown = (event) => {
    // The chevron is a separate button; let its native keyboard click run once.
    if (event.target !== event.currentTarget || isBlockedNavigation) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick();
      return;
    }

    if (event.key === 'ArrowRight' && hasChildren && !isOpen) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowLeft' && hasChildren && isOpen) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const rows = [...(event.currentTarget.closest('[role="tree"]')?.querySelectorAll('[role="treeitem"]') || [])]
        .filter((row) => row.tabIndex >= 0 && !row.closest('[hidden]'));
      const current = rows.indexOf(event.currentTarget);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? rows.length - 1
          : current + (event.key === 'ArrowDown' ? 1 : -1);
      if (current !== -1 && rows[next]) {
        event.preventDefault();
        rows[next].focus();
      }
    }
  };

  return (
    <div role="none">
      <div
        ref={rowRef}
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        onKeyDown={handleRowKeyDown}
        role="treeitem"
        tabIndex={isBlockedNavigation ? -1 : 0}
        aria-disabled={isBlockedNavigation || undefined}
        aria-expanded={hasChildren ? Boolean(isOpen) : undefined}
        aria-owns={hasChildren && !item.lockedDropdown && (isOpen || expansion.hasOpened) ? groupId : undefined}
        aria-selected={isActive}
        aria-level={level + 1}
        title={isBlockedNavigation ? `${item.label} — unavailable` : undefined}
        className={cn(
          'admin-tree-row mx-1 flex items-center min-h-[28px] h-[28px] pr-2 select-none text-[11px] font-normal rounded-[var(--radius-sm)]',
          showArrow && 'admin-tree-branch',
          isBlockedNavigation ? 'cursor-not-allowed' : 'cursor-default',
          'transition-colors duration-100',
          isActive
            ? 'bg-[color:var(--accent-100)] text-[color:var(--text-primary)] font-semibold shadow-[inset_2px_0_0_var(--accent-500)]'
            : isBlockedNavigation
              ? 'text-[color:var(--text-muted)]'
              : 'text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] hover:text-[color:var(--text-primary)]'
        )}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
      >
        <button
          type="button"
          disabled={isBlockedNavigation || !hasChildren}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label}`}
          onClick={handleArrowClick}
          onDoubleClick={event => event.stopPropagation()}
          className={cn(
            'w-6 h-6 flex items-center justify-center shrink-0 rounded-sm enabled:hover:bg-[color:var(--bg-surface-3)] focus:outline-none',
            isBlockedNavigation ? 'cursor-not-allowed' : 'cursor-default'
          )}
          tabIndex={hasChildren && !isBlockedNavigation ? 0 : -1}
        >
          {showArrow && (
            <ChevronRight
              size={11}
              className={cn(
                'text-[color:var(--text-muted)] transition-transform duration-150',
                !item.lockedDropdown && isOpen && 'rotate-90'
              )}
            />
          )}
        </button>

        <div className={cn('w-4 h-4 flex items-center justify-center shrink-0', isActive ? 'text-[color:var(--accent-600)]' : 'text-[color:var(--text-muted)]')}>
          <Icon size={13} />
        </div>

        <span className="admin-tree-label ml-1.5 whitespace-nowrap overflow-hidden text-ellipsis leading-tight flex-1">
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 text-[11px] font-mono text-[color:var(--text-muted)]">
              {item.countInParentheses ? `(${item.count})` : item.count}
            </span>
          )}
        </span>
        {isBlockedNavigation && <LockKeyhole size={11} className="ml-2 shrink-0 text-[color:var(--text-muted)] opacity-60" aria-hidden="true" />}
      </div>

      {hasChildren && !item.lockedDropdown && (isOpen || expansion.hasOpened) && (
        <div id={groupId} role="group" hidden={!isOpen}>
          {item.renderChildren ? item.renderChildren({ level: level + 1 }) : item.children.map((child, index) => {
            const ChildItem = child.component || TreeItem;
            return <ChildItem
              key={child.id || `${child.label}-${index}`}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              selectedLabel={selectedLabel}
              selectedId={selectedId}
              refreshTrigger={refreshTrigger}
              groupExplorerReveal={groupExplorerReveal}
            />;
          })}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
