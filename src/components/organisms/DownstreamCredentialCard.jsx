// One session role's credential and connection status. Actions are confirmed
// by the parent view before any request is sent.
const connectionLabel = value => ({connected: 'connected (observed)', disconnected: 'disconnected', not_observed: 'not observed'}[value] || value || 'not observed');
const verificationLabel = value => (value === 'not_verified' || !value ? 'not verified' : value);

export default function DownstreamCredentialCard({role, grant, profile, profileError, busy, onAction}) {
  const session = grant[role + '_session'];
  const credential = grant[role + '_credential'];
  const scope = grant.authority[role] || {};
  const active = credential.state === 'active';
  const hasOperations = Array.isArray(scope.operations) && scope.operations.length > 0;
  const available = profile?.status === 'available';
  return (
    <section className="lp-downstream-card" aria-label={`${role} credential`}>
      <h4>{role === 'quote' ? 'Quote session' : 'Trade session'}</h4>
      <dl className="lp-downstream-facts">
        <dt>SenderCompID / Username</dt><dd>{session.session_id}</dd>
        <dt>Role scope</dt><dd>{scope.enabled ? 'enabled' : 'disabled'} · {hasOperations ? scope.operations.join(', ') : 'no operations'}</dd>
        <dt>Credential</dt>
        <dd>
          {credential.state} · revision {credential.revision}
          {credential.emergency_revoked && <span className="lp-downstream-badge lp-downstream-badge-danger">emergency revoked</span>}
        </dd>
      </dl>
      <div className="lp-downstream-badges">
        <span className="lp-downstream-badge">Connection: {connectionLabel(profile?.connection)}</span>
        <span className="lp-downstream-badge">Verification: {verificationLabel(profile?.verification)}</span>
      </div>
      {profileError && <p role="alert">{profileError}</p>}
      {available ? (
        <dl className="lp-downstream-facts" aria-label={`${role} connection profile`}>
          <dt>Host</dt><dd>{profile.host}</dd>
          <dt>Port</dt><dd>{profile.port}</dd>
          <dt>TLS</dt><dd>{profile.tls_mode}{profile.certificate_sha256 ? ` · SHA-256 ${profile.certificate_sha256}` : ''}</dd>
          <dt>SenderCompID</dt><dd>{profile.sender_comp_id}</dd>
          <dt>TargetCompID</dt><dd>{profile.target_comp_id}</dd>
        </dl>
      ) : (
        <p>Connection profile unavailable{profile?.status ? ` (${profile.status})` : ''}.</p>
      )}
      <div className="lp-downstream-actions">
        {!active && <button type="button" disabled={busy || !hasOperations} onClick={() => onAction(role, 'issue')}>Issue {role} credential</button>}
        {active && <button type="button" disabled={busy} onClick={() => onAction(role, 'rotate')}>Rotate {role} credential</button>}
        {active && <button type="button" disabled={busy} onClick={() => onAction(role, 'revoke')}>Revoke {role} credential</button>}
      </div>
      {!hasOperations && <p>Grant this role at least one operation before issuing a credential.</p>}
    </section>
  );
}
