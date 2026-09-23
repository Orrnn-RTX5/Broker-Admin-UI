// Category folders can exist in the feed catalogue before they are saved as
// editable category records. Never manufacture database IDs for those folders.
export function categoryCatalogue(categories, instruments) {
  const nodes = categories.map(row => ({...row, key: row.id != null ? `saved:${row.id}` : `named:${row.path || row.name}`, isVirtual: false, symbols: [], parentKey: null}));
  const ids = new Map(nodes.filter(row => row.id != null).map(row => [String(row.id), row]));
  const names = new Map();
  const normalize = value => String(value || '').trim().toLowerCase();
  for (const node of nodes) {
    for (const value of [node.path, node.name]) if (value && !names.has(normalize(value))) names.set(normalize(value), node);
    node.parentKey = ids.get(String(node.parentId ?? node.parent_id))?.key || null;
  }
  const seen = new Set();
  for (const instrument of instruments) {
    if (!instrument.symbol || seen.has(instrument.symbol)) continue;
    seen.add(instrument.symbol);
    const name = String(instrument.category || 'Uncategorized').trim() || 'Uncategorized';
    let node = ids.get(String(instrument.category_id ?? instrument.categoryId)) || names.get(normalize(name));
    if (!node) {
      node = {key: `catalogue:${normalize(name)}`, name, path: name, isVirtual: true, parentKey: null, symbols: []};
      nodes.push(node); names.set(normalize(name), node);
    }
    node.symbols.push(instrument);
  }
  const byKey = new Map(nodes.map(row => [row.key, row]));
  // Bad parent references must not hide categories or recurse indefinitely.
  for (const node of nodes) {
    const ancestors = new Set([node.key]);
    let parent = byKey.get(node.parentKey);
    while (parent) {
      if (ancestors.has(parent.key)) {node.parentKey = null; break;}
      ancestors.add(parent.key); parent = byKey.get(parent.parentKey);
    }
  }
  for (const node of nodes) node.symbols.sort((a,b) => a.symbol.localeCompare(b.symbol));
  return nodes.sort((a,b) => a.name.localeCompare(b.name));
}
