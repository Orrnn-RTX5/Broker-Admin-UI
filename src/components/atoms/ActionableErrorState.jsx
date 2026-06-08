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
      className={`flex items-start gap-2 border border-red-500/30 bg-red-500/10 text-[11px] rounded-[2px] ${compact ? 'p-2' : 'm-3 p-3'} ${className}`}
    >
      <AlertCircle size={compact ? 13 : 15} className="text-red-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-red-300">{errorState.title}</div>
        {errorState.detail && (
          <div className="mt-0.5 text-[#ccc] break-words">{errorState.detail}</div>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 inline-flex items-center gap-1 h-[22px] px-2 bg-red-500/20 hover:bg-red-500/30 text-red-100 border border-red-500/30 rounded-[2px]"
        >
          <RefreshCw size={11} />
          {errorState.actionLabel || 'Retry'}
        </button>
      )}
    </div>
  );
};

export default ActionableErrorState;
