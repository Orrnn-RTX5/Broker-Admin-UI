import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DUMMY_GROUPS_STORAGE_KEY, DUMMY_GROUPS_VERSION,
  addDummyGroup, createDummyGroupsSeed, deleteDummyFolder, deleteDummyGroup,
  duplicateDummyGroup, renameDummyFolder, restoreDummyGroups, updateDummyGroup,
} from '../utils/dummyGroups.js';

// A dedicated browser key keeps examples separate from real broker data.
const storage = createJSONStorage(() => ({
  getItem: (key) => {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  setItem: (key, value) => {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* Session editing still works if storage is full. */ }
  },
  removeItem: (key) => {
    try { globalThis.localStorage?.removeItem(key); } catch { /* Storage may be unavailable. */ }
  },
}));

export const useDummyGroupsStore = create(persist((set, get) => ({
  mode: 'dummy',
  groups: createDummyGroupsSeed(),
  revision: 0,
  setMode: (mode) => {
    if (mode !== 'dummy' && mode !== 'server') throw new Error('Choose Dummy or Server data.');
    set({ mode });
  },
  addGroup: (draft) => {
    const result = addDummyGroup(get().groups, draft);
    set(state => ({ groups: result.groups, revision: state.revision + 1 }));
    return result.group;
  },
  updateGroup: (id, patch) => {
    const result = updateDummyGroup(get().groups, id, patch);
    set(state => ({ groups: result.groups, revision: state.revision + 1 }));
    return result.group;
  },
  duplicateGroup: (id, path) => {
    const result = duplicateDummyGroup(get().groups, id, path);
    set(state => ({ groups: result.groups, revision: state.revision + 1 }));
    return result.group;
  },
  deleteGroup: (id) => {
    const groups = deleteDummyGroup(get().groups, id);
    set(state => ({ groups, revision: state.revision + 1 }));
  },
  renameFolder: (path, nextPath) => {
    const groups = renameDummyFolder(get().groups, path, nextPath);
    set(state => ({ groups, revision: state.revision + 1 }));
  },
  moveGroup: (id, path) => get().updateGroup(id, { path }),
  moveFolder: (path, nextPath) => get().renameFolder(path, nextPath),
  deleteFolder: (path) => {
    const groups = deleteDummyFolder(get().groups, path);
    set(state => ({ groups, revision: state.revision + 1 }));
  },
  reset: () => set(state => ({ groups: createDummyGroupsSeed(), revision: state.revision + 1 })),
}), {
  name: DUMMY_GROUPS_STORAGE_KEY,
  version: DUMMY_GROUPS_VERSION,
  storage,
  partialize: state => ({ mode: state.mode, groups: state.groups }),
  migrate: () => ({ mode: 'dummy', groups: createDummyGroupsSeed() }),
  merge: (stored, current) => ({
    ...current,
    mode: stored?.mode === 'server' ? 'server' : 'dummy',
    groups: stored?.groups === undefined ? current.groups : restoreDummyGroups(stored.groups),
  }),
}));
