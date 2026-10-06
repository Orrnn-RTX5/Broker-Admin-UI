import {useState} from 'react';

// One-time credential export. The secret lives only in the parent's React
// state until this dialog closes; it is never written to browser storage.
const profileLines = profile => profile?.status === 'available'
  ? [
    ['BeginString', profile.begin_string || 'FIX.4.4'],
    ['Host', profile.host],
    ['Port', String(profile.port)],
    ['TLS', profile.tls_mode],
    ['Certificate SHA-256', profile.certificate_sha256 || ''],
    ['TargetCompID', profile.target_comp_id],
    ['HeartBtInt', profile.heartbeat_seconds ? String(profile.heartbeat_seconds) : ''],
    ['ResetSeqNumFlag', profile.reset_seq_num_flag || 'N'],
  ].filter(([, value]) => value)
  : [];

const exportText = value => {
  const e = value.export;
  return [
    `# RTX5 downstream ${e.role} session (FIX 4.4). One-time export; store it securely.`,
    `AccessID=${e.access_id}`,
    `Role=${e.role}`,
    `SenderCompID=${e.sender_comp_id}`,
    `Username=${e.username}`,
    `Password=${e.password}`,
    `CredentialRevision=${e.credential_revision}`,
    `ProfileStatus=${e.profile_status}`,
    ...profileLines(e.profile).map(([key, item]) => `${key.replace(/[^A-Za-z0-9]/g, '')}=${item}`),
    '',
  ].join('\n');
};

export default function DownstreamExportModal({value, onClose}) {
  const [copied, setCopied] = useState('');
  if (!value?.export) return null;
  const e = value.export;
  const available = e.profile?.status === 'available';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(e.password);
      setCopied('Secret copied to the clipboard.');
    } catch {
      setCopied('Copy failed. Select the secret and copy it manually.');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportText(value)], {type: 'text/plain'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `downstream-${e.role}-${e.sender_comp_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="lp-downstream-overlay">
      <div className="lp-downstream-dialog" role="dialog" aria-modal="true" aria-label="One-time credential export">
        <h3>One-time {e.role} credential</h3>
        <p role="status">This secret is shown once. It cannot be read again; a lost secret requires rotation.</p>
        <dl className="lp-downstream-facts">
          <dt>Access</dt><dd>{e.access_id}</dd>
          <dt>SenderCompID / Username</dt><dd>{e.sender_comp_id}</dd>
          <dt>Credential revision</dt><dd>{e.credential_revision}</dd>
          <dt>Secret</dt><dd><input aria-label="One-time secret" readOnly value={e.password} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()}/></dd>
        </dl>
        {available ? (
          <dl className="lp-downstream-facts" aria-label="Connection profile">
            {profileLines(e.profile).map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{item}</dd></div>)}
          </dl>
        ) : (
          <p>Connection profile unavailable ({e.profile_status}). Host, port, TLS and CompIDs are issued only from a serving listener; a secret alone is not access.</p>
        )}
        <div className="lp-downstream-actions">
          <button type="button" onClick={copy}>Copy secret</button>
          <button type="button" onClick={download}>Download export</button>
          <button type="button" onClick={() => { setCopied(''); onClose(); }}>Close and clear</button>
        </div>
        {copied && <p role="status">{copied}</p>}
      </div>
    </div>
  );
}
