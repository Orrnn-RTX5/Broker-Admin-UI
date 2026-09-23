export function categoryDisplayName(value, categories = []) {
  const name = typeof value === 'string' ? value : value?.category || value?.name || '';
  let node = typeof value === 'object' && value?.name && !value?.category ? value :
    categories.find(row => value?.category_id != null && String(row.id) === String(value.category_id)) ||
    categories.find(row => row.name === name || row.path === name);
  if (!node) return String(name).split(/[\\/]+/).filter(Boolean).join(' ');
  const parts = [], seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    parts.unshift(node.name);
    const parentId = node.parentId ?? node.parent_id;
    const parent = categories.find(row => (parentId != null && String(row.id) === String(parentId)) || (node.parentKey && row.key === node.parentKey));
    if (!parent && parts.length === 1 && node.path) return String(node.path).split(/[\\/]+/).filter(Boolean).join(' ');
    node = parent;
  }
  return parts.filter(Boolean).join(' ');
}
