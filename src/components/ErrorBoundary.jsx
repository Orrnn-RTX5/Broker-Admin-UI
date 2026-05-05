import React from 'react';

export class ErrorBoundary extends React.Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null, info: null });

  reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[color:var(--bg-app)] text-[color:var(--text-primary)] p-6 font-sans overflow-auto">
        <div className="max-w-2xl w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-md p-6 shadow-xl">
          <div className="text-[14px] font-semibold mb-2">Something broke</div>
          <div className="text-[12px] text-[color:var(--text-secondary)] mb-4">
            The UI hit an unrecoverable error. Try the actions below — if it keeps happening,
            copy the details and send them to support.
          </div>
          <pre className="text-[11px] font-mono bg-[color:var(--bg-surface-2)] border border-[color:var(--border-subtle)] rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap text-[color:var(--danger-500)]">
{String(this.state.error?.stack || this.state.error)}
{this.state.info?.componentStack || ''}
          </pre>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={this.reset}
              className="h-8 px-3 text-[12px] rounded border border-[color:var(--border-default)] hover:bg-[color:var(--bg-surface-2)]">
              Try again
            </button>
            <button onClick={this.reload}
              className="h-8 px-3 text-[12px] rounded bg-[color:var(--accent-500)] text-white">
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
