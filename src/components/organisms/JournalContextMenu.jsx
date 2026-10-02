import { createElement } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Check, ChevronRight, Copy, FolderOpen, Search, X } from 'lucide-react';
import { SERVER_JOURNAL_COLUMNS } from '../../utils/serverJournal.js';
import './JournalMenu.css';

function MenuAction({ icon, label, shortcut, disabled, onSelect, title, tone = '', command }) {
  return (
    <ContextMenu.Item className="journal-menu-item" disabled={disabled} onSelect={onSelect} title={title} data-journal-command={command}>
      <span className={'journal-menu-icon ' + tone}>{createElement(icon, { size: 14, 'aria-hidden': true })}</span>
      <span>{label}</span>
      {shortcut && <span className="journal-menu-shortcut" aria-hidden="true">{shortcut}</span>}
    </ContextMenu.Item>
  );
}

function MenuSetting({ label, checked, shortcut, onCheckedChange, disabled, stayOpen = false, command }) {
  return (
    <ContextMenu.CheckboxItem
      className="journal-menu-item"
      checked={checked}
      disabled={disabled}
      data-journal-command={command}
      onCheckedChange={onCheckedChange}
      onSelect={stayOpen ? event => event.preventDefault() : undefined}
    >
      <span className="journal-menu-icon"><ContextMenu.ItemIndicator><Check size={13} aria-hidden="true" /></ContextMenu.ItemIndicator></span>
      <span>{label}</span>
      {shortcut && <span className="journal-menu-shortcut" aria-hidden="true">{shortcut}</span>}
    </ContextMenu.CheckboxItem>
  );
}

export default function JournalContextMenu({
  children, selectedEntry, canClear, autoScroll, autoArrange, grid, columns,
  onOpen, onCopy, onViewer, onClear, onAutoScrollChange, onAutoArrangeChange, onGridChange,
  onColumnToggle, onRestoreColumns,
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="journal-menu" collisionPadding={8} aria-label="Journal actions"
          onKeyDown={event => {
            let command;
            if (!event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') command = 'copy';
            else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              if (event.key.toLowerCase() === 'a') command = 'auto-arrange';
              if (event.key.toLowerCase() === 'g') command = 'grid';
            }
            if (!command) return;
            const item = event.currentTarget.querySelector(`[data-journal-command="${command}"]:not([data-disabled])`);
            if (!item) return;
            event.preventDefault();
            event.stopPropagation();
            item.click();
          }}>
          <MenuAction icon={FolderOpen} label="Open" tone="is-open" disabled={!selectedEntry} onSelect={onOpen} />
          <MenuAction icon={Copy} label="Copy" shortcut="Ctrl+C" tone="is-copy" disabled={!selectedEntry} onSelect={onCopy} command="copy" />
          <MenuAction icon={Search} label="Viewer" tone="is-copy" disabled={!canClear} onSelect={onViewer} />
          <MenuAction icon={X} label="Clear" tone="is-clear" disabled={!canClear} onSelect={onClear} title="Clear displayed events; server records are retained" />
          <ContextMenu.Separator className="journal-menu-separator" />
          <MenuSetting label="Auto Scroll" checked={autoScroll} onCheckedChange={onAutoScrollChange} />
          <MenuSetting label="Auto Arrange" checked={autoArrange} shortcut="A" onCheckedChange={onAutoArrangeChange} command="auto-arrange" />
          <MenuSetting label="Grid" checked={grid} shortcut="G" onCheckedChange={onGridChange} command="grid" />
          <ContextMenu.Separator className="journal-menu-separator" />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="journal-menu-item">
              <span className="journal-menu-icon" />
              <span>Columns</span>
              <ChevronRight size={12} className="journal-menu-arrow" aria-hidden="true" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="journal-menu journal-menu-columns" sideOffset={3} alignOffset={-4} collisionPadding={8} aria-label="Journal columns">
                {SERVER_JOURNAL_COLUMNS.map(column => (
                  <MenuSetting key={column} label={column} checked={columns.includes(column)}
                    disabled={columns.length === 1 && columns.includes(column)}
                    onCheckedChange={() => onColumnToggle(column)} stayOpen />
                ))}
                <ContextMenu.Separator className="journal-menu-separator" />
                <ContextMenu.Item className="journal-menu-item" onSelect={onRestoreColumns}>
                  <span className="journal-menu-icon" />
                  <span>Restore columns</span>
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
