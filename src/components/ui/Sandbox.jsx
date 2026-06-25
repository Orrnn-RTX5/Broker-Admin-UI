import React from 'react';
import {
  Button, Input, Label, Card, CardHeader, CardTitle, CardBody, CardFooter,
  Modal, Badge, StatusDot, IconButton, Checkbox, Select,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Tooltip, TooltipProvider,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  Table, THead, TR, TH, TD, TreeNode,
  ToastProvider, ToastViewport, useToast,
} from './index';
import {
  Plus, Search, Settings, Trash2, Copy, MoreVertical,
  Folder, FolderOpen, User, Server, ChevronsUpDown,
} from 'lucide-react';

const SandboxInner = () => {
  const [theme, setTheme] = React.useState('light');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(true);
  const [sel, setSel] = React.useState('demo');
  const [tab, setTab] = React.useState('managers');
  const [expanded, setExpanded] = React.useState({ groups: true, demo: true });
  const { notify } = useToast();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const rows = [
    ['MGR-001', 'Administrator', 'success', 'Active',  '192.168.1.10', '14:32:08'],
    ['MGR-002', 'Dealer',        'success', 'Active',  '192.168.1.42', '14:31:55'],
    ['MGR-003', 'Risk Manager',  'warning', 'Idle',    '192.168.1.88', '14:18:22'],
    ['MGR-004', 'Viewer',        'neutral', 'Offline', '—',            '—'],
  ];

  const rowsPayloadBytes = JSON.stringify(rows).length;
  const rowsPayloadLabel = rowsPayloadBytes >= 1024
    ? `${(rowsPayloadBytes / 1024).toFixed(1)} KB`
    : `${rowsPayloadBytes} B`;

  return (
    <div className="min-h-screen w-full bg-[color:var(--bg-app)] text-[color:var(--text-primary)] overflow-auto">
      {/* Top chrome */}
      <div className="h-10 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-1)] flex items-center px-4 gap-4">
        <div className="text-[12px] font-semibold tracking-tight">RTX5 / Design System</div>
        <div className="text-[11px] text-[color:var(--text-muted)]">Phase 1 preview · all primitives</div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={theme === 'light' ? 'primary' : 'ghost'} size="sm" onClick={() => setTheme('light')}>Light</Button>
          <Button variant={theme === 'dark' ? 'primary' : 'ghost'} size="sm" onClick={() => setTheme('dark')}>Dark</Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Palette */}
        <Card>
          <CardHeader>
            <CardTitle>Palette</CardTitle>
            <span className="text-[11px] text-[color:var(--text-muted)] font-mono">4 neutrals · 1 accent · 4 semantic</span>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-4 gap-0 border border-[color:var(--border-subtle)] rounded-[var(--radius-sm)] overflow-hidden">
              {[
                ['bg/app',        'var(--bg-app)'],
                ['bg/surface-1',  'var(--bg-surface-1)'],
                ['bg/surface-2',  'var(--bg-surface-2)'],
                ['bg/surface-3',  'var(--bg-surface-3)'],
                ['text/primary',  'var(--text-primary)'],
                ['text/secondary','var(--text-secondary)'],
                ['text/muted',    'var(--text-muted)'],
                ['accent',        'var(--accent-500)'],
              ].map(([name, value], i) => (
                <div key={name} className={`border-[color:var(--border-subtle)] ${i % 4 !== 3 ? 'border-r' : ''} ${i < 4 ? 'border-b' : ''}`}>
                  <div className="h-12" style={{ background: value }} />
                  <div className="px-3 py-2 text-[11px] font-mono">
                    <div>{name}</div>
                    <div className="text-[color:var(--text-muted)]">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Controls row */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Buttons & Icons</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" leftIcon={<Plus size={12} />}>New</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger" leftIcon={<Trash2 size={12} />}>Delete</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content="Settings">
                  <IconButton aria-label="Settings"><Settings size={14} /></IconButton>
                </Tooltip>
                <Tooltip content="Copy">
                  <IconButton aria-label="Copy"><Copy size={14} /></IconButton>
                </Tooltip>
                <Tooltip content="Delete">
                  <IconButton aria-label="Delete"><Trash2 size={14} /></IconButton>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton aria-label="More"><MoreVertical size={14} /></IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem shortcut="⌘E">Edit</DropdownMenuItem>
                    <DropdownMenuItem shortcut="⌘D">Duplicate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem shortcut="⌫">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="secondary" onClick={() => notify({ title: 'Saved', description: 'Changes committed.', tone: 'success' })}>
                  Fire toast
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Form</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div>
                <Label>Login</Label>
                <Input placeholder="manager@rtx5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Environment</Label>
                  <Select
                    value={sel}
                    onValueChange={setSel}
                    placeholder="Select…"
                    options={[
                      { value: 'demo', label: 'Demo' },
                      { value: 'live', label: 'Live' },
                      { value: 'stg',  label: 'Staging' },
                    ]}
                  />
                </div>
                <div>
                  <Label>Invalid</Label>
                  <Input invalid defaultValue="bad.value" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[color:var(--text-secondary)]">
                <Checkbox checked={checked} onCheckedChange={setChecked} />
                Enable 2FA
              </label>
            </CardBody>
          </Card>
        </div>

        {/* Badges */}
        <Card>
          <CardHeader><CardTitle>Badges & Status</CardTitle></CardHeader>
          <CardBody className="flex flex-wrap items-center gap-3">
            <Badge>Neutral</Badge>
            <Badge tone="success">Active</Badge>
            <Badge tone="warning">Idle</Badge>
            <Badge tone="danger">Error</Badge>
            <Badge tone="info">Info</Badge>
            <span className="flex items-center gap-1.5 text-[12px]"><StatusDot tone="success"/>Connected</span>
            <span className="flex items-center gap-1.5 text-[12px]"><StatusDot tone="warning"/>Degraded</span>
            <span className="flex items-center gap-1.5 text-[12px]"><StatusDot tone="danger"/>Down</span>
          </CardBody>
        </Card>

        {/* Tabs + Table with context menu */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Filter…" className="h-7 w-48 text-[12px]" />
              <Button size="sm" variant="secondary" leftIcon={<Search size={12} />}>Search</Button>
              <Button size="sm" leftIcon={<Plus size={12} />} onClick={() => setModalOpen(true)}>Add</Button>
            </div>
          </CardHeader>
          <div className="px-4 pt-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="managers">Managers</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
                <TabsTrigger value="servers">Servers</TabsTrigger>
              </TabsList>
              <TabsContent value="managers">
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <tr>
                        <TH className="w-8"><Checkbox /></TH>
                        <TH>ID</TH>
                        <TH>Role</TH>
                        <TH>Status</TH>
                        <TH>IP</TH>
                        <TH align="right">Last Seen</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {rows.map(([id, role, tone, status, ip, seen]) => (
                        <ContextMenu key={id}>
                          <ContextMenuTrigger asChild>
                            <TR>
                              <TD><Checkbox /></TD>
                              <TD className="text-[color:var(--text-primary)]">{id}</TD>
                              <TD className="font-sans">{role}</TD>
                              <TD>
                                <span className="inline-flex items-center gap-1.5 font-sans">
                                  <StatusDot tone={tone} />
                                  {status}
                                </span>
                              </TD>
                              <TD>{ip}</TD>
                              <TD align="right">{seen}</TD>
                            </TR>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem shortcut="↵">Open</ContextMenuItem>
                            <ContextMenuItem shortcut="⌘E">Edit</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem shortcut="⌫">Delete</ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="groups">
                <div className="p-8 text-center text-[12px] text-[color:var(--text-muted)]">No groups.</div>
              </TabsContent>
              <TabsContent value="servers">
                <div className="p-8 text-center text-[12px] text-[color:var(--text-muted)]">No servers.</div>
              </TabsContent>
            </Tabs>
          </div>
          <CardFooter>
            <span className="text-[11px] text-[color:var(--text-muted)] font-mono mr-auto">{rows.length} rows</span>
            <Button size="sm" variant="ghost">Prev</Button>
            <Button size="sm" variant="ghost">Next</Button>
          </CardFooter>
        </Card>

        {/* Tree */}
        <Card>
          <CardHeader><CardTitle>Navigation Tree</CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="py-1">
              <TreeNode
                label="Groups"
                icon={expanded.groups ? <FolderOpen size={12} /> : <Folder size={12} />}
                hasChildren
                expanded={expanded.groups}
                depth={0}
                onClick={() => setExpanded((p) => ({ ...p, groups: !p.groups }))}
              />
              {expanded.groups && (
                <>
                  <TreeNode
                    label="Demo"
                    icon={expanded.demo ? <FolderOpen size={12} /> : <Folder size={12} />}
                    hasChildren
                    expanded={expanded.demo}
                    depth={1}
                    onClick={() => setExpanded((p) => ({ ...p, demo: !p.demo }))}
                  />
                  {expanded.demo && (
                    <>
                      <TreeNode label="USD-Standard" icon={<User size={12} />} depth={2} selected />
                      <TreeNode label="EUR-Standard" icon={<User size={12} />} depth={2} />
                    </>
                  )}
                  <TreeNode label="Live" icon={<Folder size={12} />} hasChildren depth={1} />
                </>
              )}
              <TreeNode label="Servers" icon={<Server size={12} />} hasChildren depth={0} />
            </div>
          </CardBody>
        </Card>

        {/* Modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Create manager"
          description="Add a new manager account to this server."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={() => { setModalOpen(false); notify({ title: 'Manager created', tone: 'success' }); }}>Create</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div><Label>Login</Label><Input placeholder="manager@rtx5" /></div>
            <div><Label>Role</Label><Input placeholder="Dealer" /></div>
          </div>
        </Modal>

        {/* Footer strip */}
        <div className="h-6 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] flex items-center px-3 text-[11px] font-mono text-[color:var(--text-muted)] gap-4">
          <span className="inline-flex items-center gap-1.5 text-[color:var(--text-secondary)]">
            <StatusDot tone="success" />
            -RTX-5
          </span>
          <span>{rows.length} / {rowsPayloadLabel}</span>
          <span className="ml-auto tabular-nums">18:42:05</span>
        </div>
      </div>
    </div>
  );
};

export const Sandbox = () => (
  <TooltipProvider>
    <ToastProvider>
      <SandboxInner />
      <ToastViewport />
    </ToastProvider>
  </TooltipProvider>
);
