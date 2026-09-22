import { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ArrowUp, ChevronRight, Copy, Folder, Pencil, Plus, Trash2, User, Users } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as ContextMenu from '@radix-ui/react-context-menu';
import DummyGroupPropertiesPopup from '../RIGHTCLICKJPOPUPS/DummyGroupPropertiesPopup';
import { useDummyGroupsStore } from '../../store/useDummyGroupsStore';
import { getDummyFolderChildren, getDummyGroupAccounts, getDummyGroupCount, getDummyParentPath, listDummyContainerPaths, makeDummyGroup, normalizeDummyPath, validateDummyGroup } from '../../utils/dummyGroups';
import './DummyGroupsExplorer.css';

const rootNode = { type: 'groups-root', id: 'groups', label: 'Groups' };
const folderNode = path => path ? { type: 'dummy-folder', id: `dummy-folder:${path}`, path, label: path.split('\\').at(-1) } : rootNode;
const dummy = value => `${value} (Dummy)`;
const joinDummyPath = (...parts) => parts.filter(Boolean).join('\\');
const samePath = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
const selectStyle = { padding: 7, border: '1px solid var(--border-default)', background: 'var(--bg-app)', color: 'var(--text-primary)' };
const GROUP_COLUMNS = ['Group', 'Risk Management', 'Margin', 'Currency'];
const ALL_GROUP_COLUMNS = ['Group', 'Type', 'Risk Management', 'Margin', 'Floating Leverage Profile', 'Currency'];
const ACCOUNT_COLUMNS = ['Login', 'Name', 'Group', 'Balance', 'Equity', 'Currency', 'Status'];

export default function DummyGroupsExplorer({ location, onNavigate, onSelectionChange, onCountChange, onRowsChange, searchQuery = '', sortDirection, dummyActionsRef }) {
  const groups = useDummyGroupsStore(state => state.groups);
  const [selectedId, setSelectedId] = useState(null);
  const [allGroups, setAllGroups] = useState(false);
  const [editor, setEditor] = useState(null);
  const [action, setAction] = useState(null);
  const [actionValue, setActionValue] = useState('');
  const [actionParent, setActionParent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const path = location.type === 'dummy-folder' ? location.path : location.type === 'admin' ? 'Admin' : '';
  // Opening a group lists its subgroups first and then its example accounts.
  const currentGroup = useMemo(() => groups.find(group => samePath(group.path, path)), [groups, path]);
  const accountView = !allGroups && Boolean(currentGroup);
  const nodes = useMemo(() => {
    if (allGroups) return groups.map(group => ({ id: group.id, type: 'group', label: group.name, path: group.path, group, count: 0 }));
    const children = getDummyFolderChildren(groups, path);
    const accounts = currentGroup ? getDummyGroupAccounts(currentGroup).map(account => ({ id: account.id, type: 'account', label: account.login, path: `${currentGroup.path}\\${account.login}`, account })) : [];
    return [...children, ...accounts];
  }, [allGroups, groups, path, currentGroup]);
  const containers = useMemo(() => listDummyContainerPaths(groups), [groups]);
  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const direction = sortDirection === 'desc' ? -1 : 1;
    return nodes.filter(node => [node.path, node.group?.currency, node.group?.riskManagement, node.account?.name, node.account?.status].some(value => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => ((a.type === 'account') - (b.type === 'account')) || direction * a.path.localeCompare(b.path, undefined, { numeric: true }));
  }, [nodes, searchQuery, sortDirection]);
  const selected = visible.find(node => node.id === selectedId);
  const columns = allGroups ? ALL_GROUP_COLUMNS : accountView ? ACCOUNT_COLUMNS : GROUP_COLUMNS;
  const rows = useMemo(() => visible.map(node => {
    if (accountView) {
      const account = node.account;
      return account
        ? { login: account.login, name: dummy(account.name), group: dummy(account.group), balance: account.balance, equity: account.equity, currency: dummy(account.currency), status: dummy(account.status) }
        : { login: dummy(node.type === 'folder' ? node.label : node.path), name: '', group: '', balance: '', equity: '', currency: '', status: '' };
    }
    return {
      group: dummy(node.type === 'folder' ? node.label : node.path),
      ...(allGroups ? { type: dummy(node.group?.settings?.margin?.riskManagement?.toLowerCase().includes('hedged') ? 'Hedged' : 'Netting') } : {}),
      risk: node.group ? dummy(node.group.riskManagement) : '',
      margin: node.group ? dummy(`${node.group.marginCallLevel} / ${node.group.stopOutLevel} ${node.group.settings?.margin?.stopOutMode === 'Percent' ? '%' : node.group.currency}`) : '',
      ...(allGroups ? { floatingLeverageProfile: dummy(node.group?.settings?.margin?.floatingLeverage || 'None') } : {}),
      currency: node.group ? dummy(node.group.currency) : '',
    };
  }), [accountView, allGroups, visible]);
  // Every group can hold subgroups, so in the folder view each group row opens like a folder.
  const inFolderView = !allGroups;
  const isAccount = node => node.type === 'account';
  const subgroupCount = group => groups.filter(item => item.path.toLowerCase().startsWith(`${group.path.toLowerCase()}\\`)).length;

  useEffect(() => {
    onCountChange?.({ total: nodes.length, filtered: rows.length, visible: rows.length, bytes: new TextEncoder().encode(JSON.stringify(rows)).length });
    onRowsChange?.(rows);
  }, [nodes.length, rows, onCountChange, onRowsChange]);
  useEffect(() => {
    onSelectionChange?.(selected?.type === 'group' ? { type: 'group', row: selected.group, id: selected.id, viewType: 'Groups' } : null);
  }, [selected, onSelectionChange]);

  const go = nextPath => { setSelectedId(null); setAllGroups(false); onNavigate(folderNode(nextPath)); };
  const addGroup = (parent = path) => {
    const name = joinDummyPath(parent, 'New Group');
    setEditor({ isNew: true, group: makeDummyGroup({ name, path: name }) });
  };
  const editGroup = group => { if (group) setEditor({ group, isNew: false }); };
  const ask = (type, node = selected) => {
    if (node && isAccount(node)) node = undefined;
    setAction({ type, node }); setError('');
    setActionParent(type === 'subgroup' ? node?.path ?? path : '');
    setActionValue(type === 'subgroup' ? 'New subgroup' : node?.path || '');
  };
  const duplicate = node => {
    if (!node?.group) return;
    const draft = structuredClone(node.group);
    const parent = getDummyParentPath(draft.path);
    const base = draft.path.split('\\').at(-1);
    let name = joinDummyPath(parent, `${base} Copy`);
    let index = 2;
    while (groups.some(group => samePath(group.path, name))) name = joinDummyPath(parent, `${base} Copy ${index++}`);
    setEditor({ isNew: true, group: makeDummyGroup({ ...draft, id: undefined, name, path: name }) });
  };
  useImperativeHandle(dummyActionsRef, () => ({
    addGroup: () => addGroup(),
    editGroup,
    deleteGroup: group => ask('delete', { id: group.id, type: 'group', path: group.path, group, count: subgroupCount(group) }),
  }));

  const saveGroup = draft => {
    const store = useDummyGroupsStore.getState();
    const saved = editor.isNew ? store.addGroup(draft) : store.updateGroup(editor.group.id, draft);
    setEditor(null); go(getDummyParentPath(saved.path)); setSelectedId(saved.id);
    setNotice(`${saved.path} saved (Dummy).`);
  };
  const applyAction = event => {
    event.preventDefault();
    try {
      const store = useDummyGroupsStore.getState();
      if (action.type === 'delete') {
        if (action.node.type === 'folder' || action.node.count > 0) store.deleteFolder(action.node.path);
        else store.deleteGroup(action.node.id);
        setSelectedId(null); setNotice('Deleted from dummy data.');
      } else if (action.type === 'rename') {
        const nextPath = normalizeDummyPath(actionValue);
        store.renameFolder(action.node.path, nextPath);
        if (path === action.node.path || path.startsWith(`${action.node.path}\\`)) go(nextPath + path.slice(action.node.path.length));
        setNotice('Subgroup path updated (Dummy).');
      } else if (action.type === 'subgroup') {
        const nextPath = normalizeDummyPath(joinDummyPath(actionParent, actionValue));
        validateDummyGroup({ path: nextPath }, groups);
        setEditor({ isNew: true, group: makeDummyGroup({ name: nextPath, path: nextPath }) });
      } else if (action.type === 'reset') {
        store.reset(); go(''); setNotice('Dummy examples restored.');
      }
      setAction(null);
    } catch (problem) { setError(problem.message); }
  };
  const activate = node => {
    if (isAccount(node)) setNotice(`Account ${node.label} is an example (Dummy). Open Trading Accounts for real records.`);
    else if (inFolderView) go(node.path);
    else editGroup(node.group);
  };
  const pathParts = path ? path.split('\\') : [];
  const canEdit = node => Boolean(node) && !isAccount(node) && node.path !== 'Admin';
  const menu = node => <ContextMenu.Portal><ContextMenu.Content className="dummy-group-menu">
    {isAccount(node) ? <ContextMenu.Item onSelect={() => activate(node)}>Account details (Dummy)</ContextMenu.Item> : <>
      <ContextMenu.Item onSelect={() => activate(node)}>{inFolderView ? 'Open' : 'Settings'}</ContextMenu.Item>
      {node.type === 'group' && inFolderView && <ContextMenu.Item onSelect={() => editGroup(node.group)}>Settings</ContextMenu.Item>}
      <ContextMenu.Item onSelect={() => addGroup(node.type === 'folder' ? node.path : path)}>Add group</ContextMenu.Item>
      <ContextMenu.Item onSelect={() => ask('subgroup', node)}>Add subgroup</ContextMenu.Item>
      {node.type === 'group' ? <ContextMenu.Item onSelect={() => duplicate(node)}>Duplicate group</ContextMenu.Item> : node.path !== 'Admin' && <ContextMenu.Item onSelect={() => ask('rename', node)}>Rename subgroup</ContextMenu.Item>}
      <ContextMenu.Separator />
      <ContextMenu.Item disabled={node.path === 'Admin'} onSelect={() => ask('delete', node)}>Delete {node.type === 'folder' ? 'subgroup' : 'group'}</ContextMenu.Item>
    </>}
  </ContextMenu.Content></ContextMenu.Portal>;

  return <section className="dummy-groups-explorer" aria-label="Dummy groups explorer">
    <div className="dummy-group-path">
      <button aria-label="Up one folder" disabled={!path || allGroups} onClick={() => go(getDummyParentPath(path))}><ArrowUp size={14} /></button>
      <nav aria-label="Group folder path">
        <button onClick={() => go('')}>Groups</button>
        {pathParts.map((part, index) => <span key={index}><ChevronRight size={12} /><button onClick={() => go(pathParts.slice(0, index + 1).join('\\'))}>{part} <small>(Dummy)</small></button></span>)}
      </nav>
    </div>
    <div className="dummy-group-tools">
      <button onClick={() => addGroup()}><Plus size={13} /> Add group</button>
      <button onClick={() => ask('subgroup')}><Folder size={13} /> Add subgroup</button>
      <button disabled={!canEdit(selected)} onClick={() => selected.type === 'group' ? editGroup(selected.group) : ask('rename')}><Pencil size={13} /> {selected?.type === 'folder' ? 'Rename' : 'Settings'}</button>
      <button disabled={selected?.type !== 'group'} onClick={() => duplicate(selected)}><Copy size={13} /> Duplicate</button>
      <button disabled={!canEdit(selected)} onClick={() => ask('delete')}><Trash2 size={13} /> Delete</button>
      <button className="dummy-group-reset" onClick={() => ask('reset')}>Reset dummy data</button>
    </div>
    <div className="dummy-group-table-wrap">
      <table aria-label={allGroups ? 'All groups (Dummy)' : accountView ? `Contents of ${path} (Dummy)` : `Groups in ${path || 'root'} (Dummy)`}>
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{visible.map((node, index) => <ContextMenu.Root key={node.id}><ContextMenu.Trigger asChild>
          <tr tabIndex={0} aria-selected={selectedId === node.id} data-dummy-path={node.path} onClick={() => setSelectedId(node.id)} onFocus={() => setSelectedId(node.id)} onContextMenu={() => setSelectedId(node.id)} onDoubleClick={() => activate(node)} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); activate(node); }
            if (event.key === 'Delete' && canEdit(node)) { event.preventDefault(); ask('delete', node); }
            if (event.key === 'F2' && canEdit(node)) { event.preventDefault(); node.type === 'folder' ? ask('rename', node) : editGroup(node.group); }
          }}>
            {Object.values(rows[index]).map((value, cell) => <td key={cell}>{cell === 0 ? <span className="dummy-group-name">{isAccount(node) ? <User size={14} /> : inFolderView ? <Folder size={14} /> : <Users size={14} />}{value}{node.type === 'folder' ? <small>({node.count} groups, Dummy)</small> : node.count > 0 && <small>({node.count} subgroups, Dummy)</small>}</span> : value}</td>)}
          </tr>
        </ContextMenu.Trigger>{menu(node)}</ContextMenu.Root>)}</tbody>
      </table>
      {!visible.length && <p className="dummy-group-empty">{searchQuery ? 'No groups match this search.' : currentGroup ? `No subgroups or accounts exist in ${currentGroup.path.split('\\').at(-1)} (Dummy). Use Add subgroup to create one.` : 'No groups in this folder. Add a group to create its branch.'}</p>}
    </div>
    <div className="dummy-group-footer"><div role="tablist" aria-label="Group list views">
      <button role="tab" aria-selected={!allGroups} onClick={() => setAllGroups(false)}>Groups {path} ({getDummyGroupCount(groups, path)} Dummy)</button>
      <button role="tab" aria-selected={allGroups} onClick={() => { setAllGroups(true); setSelectedId(null); }}>All Groups ({groups.length} Dummy)</button>
    </div><span role="status">{notice || 'Double-click a group to open its subgroups and accounts; use Settings to edit a group.'}</span></div>
    {editor && <DummyGroupPropertiesPopup key={editor.group.id} group={editor.group} isNew={editor.isNew} onSave={saveGroup} onClose={() => setEditor(null)} />}
    <Dialog.Root open={Boolean(action)} onOpenChange={open => { if (!open) setAction(null); }}><Dialog.Portal><Dialog.Overlay className="dummy-group-overlay" /><Dialog.Content className="dummy-group-action-dialog">
      <Dialog.Title>{action?.type === 'delete' ? 'Delete dummy data' : action?.type === 'reset' ? 'Reset dummy data' : action?.type === 'rename' ? 'Rename subgroup' : 'Add subgroup'}</Dialog.Title>
      <Dialog.Description>{action?.type === 'delete' ? `Remove ${action.node.path} (Dummy)${action.node.type === 'folder' || action.node.count > 0 ? ' and all groups inside it' : ''}?` : action?.type === 'reset' ? 'Restore the nine example groups and discard your local dummy edits?' : action?.type === 'rename' ? 'Subgroups are formed from the backslash-separated group path.' : 'Choose the group that will contain the new subgroup, then name it. Its full name joins both with a backslash.'}</Dialog.Description>
      <form onSubmit={applyAction}>
        {action?.type === 'subgroup' && <div style={{ display: 'grid', gap: 10 }}>
          <label>Inside group (Dummy)<select value={actionParent} onChange={event => setActionParent(event.target.value)} style={selectStyle}>
            <option value="">Groups (top level)</option>
            {containers.map(container => <option key={container} value={container}>{container}</option>)}
          </select></label>
          <label>Subgroup name (Dummy)<input autoFocus value={actionValue} onChange={event => setActionValue(event.target.value)} /></label>
        </div>}
        {action?.type === 'rename' && <label>Subgroup path (Dummy)<input autoFocus value={actionValue} onChange={event => setActionValue(event.target.value)} /></label>}
        {error && <p role="alert">{error}</p>}
        <div className="dummy-group-action-footer"><button type="button" onClick={() => setAction(null)}>Cancel</button><button type="submit">{action?.type === 'delete' ? 'Delete' : action?.type === 'reset' ? 'Reset' : action?.type === 'subgroup' ? 'Continue' : 'Save'}</button></div>
      </form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
