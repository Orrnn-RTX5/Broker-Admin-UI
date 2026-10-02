import { useEffect, useState } from 'react';
import { ManagerService } from '../../services/manager.service';

export default function GroupAccessFields({ mode, groups, onChange, children }) {
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const selected = Array.isArray(groups) ? groups : String(groups || '').split(',').map(x => x.trim()).filter(Boolean);
  const hasCustomPicker = Boolean(children);
  useEffect(() => {
    if (hasCustomPicker) return;
    let active = true;
    ManagerService.getGroupList().then(rows => {
      if (active) setOptions(Array.isArray(rows) ? rows : []);
    }).catch(() => { if (active) setError('Unable to load assignable groups.'); });
    return () => { active = false; };
  }, [hasCustomPicker]);
  return <div className="space-y-2 text-[12px]">
    <label className="block">Group configuration access
      <select className="block w-full p-2 bg-[color:var(--bg-surface-2)]" value={mode} onChange={e => onChange(e.target.value, selected)}>
        <option value="none">No groups</option>
        <option value="restricted">Selected groups</option>
        <option value="all_within_broker">All groups</option>
      </select>
    </label>
    {mode === 'restricted' && (children || <label className="block">Assigned groups
      <select multiple required value={selected} className="block w-full p-2 min-h-24 bg-[color:var(--bg-surface-2)]"
        onChange={e => onChange(mode, Array.from(e.target.selectedOptions, option => option.value))}>
        {options.map(group => <option key={group.name} value={group.name}>{group.name}</option>)}
      </select>
    </label>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}
