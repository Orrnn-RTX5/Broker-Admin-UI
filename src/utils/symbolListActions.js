const selectionSet = (selectedIds) => new Set(selectedIds ?? []);

export const canMoveSelectedSymbols = (items, selectedIds, direction) => {
  if (direction !== -1 && direction !== 1) return false;
  const selected = selectionSet(selectedIds);
  const indexes = items.flatMap((item, index) => selected.has(item.id) ? [index] : []);
  if (!indexes.length) return false;
  return direction === -1 ? indexes[0] > 0 : indexes.at(-1) < items.length - 1;
};

/** Shift each selected block one row, preserving the order within both sets. */
export const moveSelectedSymbols = (items, selectedIds, direction) => {
  if (!canMoveSelectedSymbols(items, selectedIds, direction)) return items;
  const selected = selectionSet(selectedIds);
  const reordered = [...items];
  const start = direction === -1 ? 1 : reordered.length - 2;
  const end = direction === -1 ? reordered.length : -1;
  const increment = -direction;
  for (let index = start; index !== end; index += increment) {
    if (selected.has(reordered[index].id)) {
      const neighbor = index + direction;
      [reordered[index], reordered[neighbor]] = [reordered[neighbor], reordered[index]];
    }
  }
  return reordered;
};

export const findSymbolMatch = (items, query, currentId, direction = 1) => {
  const search = String(query ?? '').trim().toLowerCase();
  if (!search || !items.length) return null;
  const step = direction === -1 ? -1 : 1;
  const currentIndex = items.findIndex(item => item.id === currentId);
  const start = currentIndex === -1 ? (step === 1 ? -1 : 0) : currentIndex;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (start + step * offset + items.length) % items.length;
    if (String(items[index].path ?? '').toLowerCase().includes(search)) return items[index].id;
  }
  return null;
};

const dummyCell = (value) => `${String(value ?? '').replace(/[\t\r\n]+/g, ' ')} (Dummy)`;

export const getSymbolClipboardText = (items, selectedIds) => {
  const selected = selectionSet(selectedIds);
  const rows = items.filter(item => selected.has(item.id)).map(item => {
    const useDefault = item.margin?.useDefault !== false;
    return [
      item.path,
      useDefault ? 'Default' : item.margin.initial,
      useDefault ? 'Default' : item.margin.maintenance,
    ].map(dummyCell).join('\t');
  });
  return ['Symbol\tInitial Margin\tMaintenance Margin', ...rows].join('\n');
};

export const rangeSymbolIds = (items, anchorId, targetId) => {
  const target = items.findIndex(item => item.id === targetId);
  if (target === -1) return [];
  const anchor = items.findIndex(item => item.id === anchorId);
  if (anchor === -1) return [targetId];
  return items.slice(Math.min(anchor, target), Math.max(anchor, target) + 1).map(item => item.id);
};
