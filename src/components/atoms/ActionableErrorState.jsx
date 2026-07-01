import { AlertCircle, RefreshCw } from 'lucide-react';

const ActionableErrorState = ({ state, title, message, actionLabel, onAction, compact = false, className = '' }) => {
  const errorState = state || {
    title: title || 'Unable to load data',
    detail: message || '',
    actionLabel: actionLabel || 'Retry',
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 text-[11px] rounded-[2px] ${compact ? 'p-2' : 'm-3 p-3'} ${className}`}
    >
      <AlertCircle size={compact ? 13 : 15} className="text-[color:var(--danger-500)] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[color:var(--danger-500)]">{errorState.title}</div>
        {errorState.detail && (
          <div className="mt-0.5 text-[color:var(--text-secondary)] break-words">{errorState.detail}</div>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 inline-flex items-center gap-1 h-[24px] px-2 bg-[color:var(--danger-500)]/18 hover:bg-[color:var(--danger-500)]/26 text-[color:var(--text-primary)] border border-[color:var(--danger-500)]/40 rounded-[2px]"
        >
          <RefreshCw size={11} />
          {errorState.actionLabel || 'Retry'}
        </button>
      )}
    </div>
  );
};

export default ActionableErrorState;
