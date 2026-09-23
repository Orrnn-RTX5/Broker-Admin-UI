export const categoryPath = (name, parent) => [parent?.path || parent?.name, String(name || '').trim()].filter(Boolean).join('/');

// Resolve catalogue parents only when the user submits. Re-read before saving
// so retries after a child failure can reuse the already-created parent.
export async function createCategoryWithParent(form, parent, {list, create}) {
  const name = String(form.name || '').trim();
  if (!name) throw new Error('Category name is required');
  const same = (a,b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  if (parent && same(parent.name, name)) throw new Error('A category cannot be its own parent');
  let parentId;
  if (parent) {
    if (!parent.isVirtual) parentId = parent.id;
    else {
      const find = rows => rows.find(row => same(row.path || row.name, parent.path || parent.name));
      let saved = find(await list());
      if (!saved) {
        try {
          saved = await create({name:parent.name, path:parent.path || parent.name, description:''});
        } catch (error) {
          saved = find(await list());
          if (!saved) throw error;
        }
      }
      parentId = saved.id;
    }
    parentId = Number(parentId);
    if (!Number.isSafeInteger(parentId) || parentId < 1) throw new Error('Parent category could not be saved. Retry.');
  }
  return create({name, parentId, path:String(form.path || '').trim() || categoryPath(name,parent), description:String(form.description || '').trim()});
}
