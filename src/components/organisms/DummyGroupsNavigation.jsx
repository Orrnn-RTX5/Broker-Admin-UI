import { Folder } from 'lucide-react';
import TreeItem from '../molecules/TreeItem';
import { useDummyGroupsStore } from '../../store/useDummyGroupsStore';
import { getDummyFolderChildren } from '../../utils/dummyGroups';

// Every group is a folder that may hold subgroups, so each one is a navigator branch.
const DummyFolder = ({ node, groups, level, ...props }) => {
  const children = getDummyFolderChildren(groups, node.path);
  return <TreeItem {...props} level={level} item={{
    ...node, id: `dummy-folder:${node.path}`, type: 'dummy-folder', icon: Folder,
    count: `${node.count} Dummy`, countInParentheses: true,
    ...(children.length ? { renderChildren: ({ level: next }) => children.map(child =>
      <DummyFolder key={child.path} node={child} groups={groups} level={next} {...props} />) } : {}),
  }} />;
};

export default function DummyGroupsNavigation({ item, level, ...props }) {
  const groups = useDummyGroupsStore(state => state.groups);
  const roots = getDummyFolderChildren(groups, '');
  return <TreeItem {...props} level={level} item={{
    ...item, id: 'groups', type: 'groups-root', children: undefined,
    count: `${groups.length} Dummy`, countInParentheses: true,
    renderChildren: ({ level: next }) => roots.map(node =>
      <DummyFolder key={node.path} node={node} groups={groups} level={next} {...props} />),
  }} />;
}
