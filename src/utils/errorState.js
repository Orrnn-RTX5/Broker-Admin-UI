import { getApiErrorMessage } from './apiShapes.js';

export const buildActionableErrorState = (error, options = {}) => {
  const title = options.title || 'Unable to load data';
  const actionLabel = options.actionLabel || 'Retry';
  const fallback = options.fallback || title;
  const detail = typeof error === 'string' && error.trim()
    ? error.trim()
    : getApiErrorMessage(error, fallback);

  return {
    title,
    detail,
    actionLabel,
  };
};
