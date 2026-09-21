import { Folder, Users } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { useDummyGroupsStore } from '../../store/useDummyGroupsStore';
import { getDummyFolderChildren } from '../../utils/dummyGroups';

const DummyFolder = ({ node, groups, level, ...props }) => {
  const children = getDummyFolderChildren(groups, node.path).filter(child => child.type === 'folder');
  return <TreeItem {...props} level={level} item={{
    ...node, type: 'dummy-folder', icon: children.length ? Folder : Users,
    count: `${node.count} Dummy`, countInParentheses: true,
    ...(children.length ? { renderChildren: ({ level: next }) => children.map(child =>
      <DummyFolder key={child.id} node={child} groups={groups} level={next} {...props} />) } : {}),
  }} />;
};

export default function DummyGroupsNavigation({ item, level, ...props }) {
  const groups = useDummyGroupsStore(state => state.groups);
  const folders = getDummyFolderChildren(groups, '').filter(node => node.type === 'folder');
  return <TreeItem {...props} level={level} item={{
    ...item, id: 'groups', type: 'groups-root', children: undefined,
    count: `${groups.length} Dummy`, countInParentheses: true,
    renderChildren: ({ level: next }) => folders.map(node =>
      <DummyFolder key={node.id} node={node} groups={groups} level={next} {...props} />),
  }} />;
}
