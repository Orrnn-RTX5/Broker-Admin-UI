import * as ContextMenu from '@radix-ui/react-context-menu';
import { Check, ChevronRight, Copy } from 'lucide-react';
import './JournalMenu.css';

const SUMMARY_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];
const SUMMARY_PROFIT_MODES = [
  { id: 'points', label: 'In Points' },
  { id: 'term', label: 'In Term Currency' },
  { id: 'deposit', label: 'In Deposit Currency' },
];

function MenuCheckItem({ label, checked, shortcut, onSelect, command }) {
  return (
    <ContextMenu.CheckboxItem
      className="journal-menu-item"
      checked={checked}
      data-summary-command={command}
      onCheckedChange={() => onSelect?.()}
    >
      <span className="journal-menu-icon">
        <ContextMenu.ItemIndicator>
          <Check size={13} aria-hidden="true" />
        </ContextMenu.ItemIndicator>
      </span>
      <span>{label}</span>
      {shortcut && <span className="journal-menu-shortcut" aria-hidden="true">{shortcut}</span>}
    </ContextMenu.CheckboxItem>
  );
}

export default function SummaryContextMenu({
  children,
  currency,
  profitMode,
  autoArrange,
  grid,
  onSelectCurrency,
  onSelectProfitMode,
  onCopy,
  onExportReport,
  onResetSortOrder,
  onToggleAutoArrange,
  onToggleGrid,
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="journal-menu"
          collisionPadding={8}
          aria-label="Summary actions"
          onKeyDown={event => {
            let command;
            if (!event.altKey && (event.ctrlKey || event.metaKey)) {
              const key = event.key.toLowerCase();
              if (key === 'c') command = 'copy';
              if (key === 'e') command = 'export-xml';
              if (key === 'h') command = 'export-html';
            } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              const key = event.key.toLowerCase();
              if (key === 'r') command = 'reset-sort';
              if (key === 'a') command = 'auto-arrange';
              if (key === 'g') command = 'grid';
            }
            if (!command) return;
            const item = event.currentTarget.querySelector(`[data-summary-command="${command}"]:not([data-disabled])`);
            if (!item) return;
            event.preventDefault();
            event.stopPropagation();
            item.click();
          }}
        >
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="journal-menu-item">
              <span className="journal-menu-icon" />
              <span>Currency</span>
              <ChevronRight size={12} className="journal-menu-arrow" aria-hidden="true" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="journal-menu journal-menu-columns" sideOffset={3} alignOffset={-4} collisionPadding={8} aria-label="Summary currency">
                {SUMMARY_CURRENCIES.map(item => (
                  <MenuCheckItem
                    key={item}
                    label={item}
                    checked={currency === item}
                    onSelect={() => onSelectCurrency(item)}
                  />
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="journal-menu-item">
              <span className="journal-menu-icon" />
              <span>Profit</span>
              <ChevronRight size={12} className="journal-menu-arrow" aria-hidden="true" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="journal-menu journal-menu-columns" sideOffset={3} alignOffset={-4} collisionPadding={8} aria-label="Summary profit mode">
                {SUMMARY_PROFIT_MODES.map(mode => (
                  <MenuCheckItem
                    key={mode.id}
                    label={mode.label}
                    checked={profitMode === mode.id}
                    onSelect={() => onSelectProfitMode(mode.id)}
                  />
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="journal-menu-separator" />

          <ContextMenu.Item className="journal-menu-item" onSelect={onCopy} data-summary-command="copy">
            <span className="journal-menu-icon is-copy">
              <Copy size={14} aria-hidden="true" />
            </span>
            <span>Copy</span>
            <span className="journal-menu-shortcut" aria-hidden="true">Ctrl+C</span>
          </ContextMenu.Item>

          <ContextMenu.Separator className="journal-menu-separator" />

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="journal-menu-item">
              <span className="journal-menu-icon" />
              <span>Report</span>
              <ChevronRight size={12} className="journal-menu-arrow" aria-hidden="true" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="journal-menu journal-menu-columns" sideOffset={3} alignOffset={-4} collisionPadding={8} aria-label="Export summary report">
                <ContextMenu.Item className="journal-menu-item" onSelect={() => onExportReport('xml')} data-summary-command="export-xml">
                  <span className="journal-menu-icon" />
                  <span>XML (MS Office Excel)</span>
                  <span className="journal-menu-shortcut" aria-hidden="true">Ctrl+E</span>
                </ContextMenu.Item>
                <ContextMenu.Item className="journal-menu-item" onSelect={() => onExportReport('html')} data-summary-command="export-html">
                  <span className="journal-menu-icon" />
                  <span>HTML (Internet Explorer)</span>
                  <span className="journal-menu-shortcut" aria-hidden="true">Ctrl+H</span>
                </ContextMenu.Item>
                <ContextMenu.Item className="journal-menu-item" onSelect={() => onExportReport('csv')}>
                  <span className="journal-menu-icon" />
                  <span>CSV (Text file)</span>
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="journal-menu-separator" />

          <ContextMenu.Item className="journal-menu-item" onSelect={onResetSortOrder} data-summary-command="reset-sort">
            <span className="journal-menu-icon" />
            <span>Reset Sort Order</span>
            <span className="journal-menu-shortcut" aria-hidden="true">R</span>
          </ContextMenu.Item>

          <MenuCheckItem
            label="Auto Arrange"
            checked={autoArrange}
            shortcut="A"
            command="auto-arrange"
            onSelect={onToggleAutoArrange}
          />

          <MenuCheckItem
            label="Grid"
            checked={grid}
            shortcut="G"
            command="grid"
            onSelect={onToggleGrid}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
