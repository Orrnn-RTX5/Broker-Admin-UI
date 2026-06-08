import { hasPermission, PERMISSION_KEYS } from './permissions.js';

export const normalizeCloseAllSymbol = (symbol) => String(symbol ?? '').trim();

export const getCloseAllActionState = ({ user, symbol, busy = false } = {}) => {
  const normalizedSymbol = normalizeCloseAllSymbol(symbol);
  const hasClosePermission = hasPermission(user, PERMISSION_KEYS.CLOSE_POSITIONS);

  if (!hasClosePermission) {
    return {
      canSubmit: false,
      hasClosePermission,
      normalizedSymbol,
      disabledReason: 'Requires close_positions permission.',
    };
  }

  if (!normalizedSymbol) {
    return {
      canSubmit: false,
      hasClosePermission,
      normalizedSymbol,
      disabledReason: 'Enter a symbol to close all positions.',
    };
  }

  if (busy) {
    return {
      canSubmit: false,
      hasClosePermission,
      normalizedSymbol,
      disabledReason: 'Close-all request is running.',
    };
  }

  return {
    canSubmit: true,
    hasClosePermission,
    normalizedSymbol,
    disabledReason: '',
  };
};

export const getCloseAllConfirmationPrompt = (symbol) =>
  `Type ${normalizeCloseAllSymbol(symbol)} to confirm closing all open positions for this symbol.`;

export const isCloseAllConfirmationAccepted = (symbol, confirmation) =>
  normalizeCloseAllSymbol(confirmation) === normalizeCloseAllSymbol(symbol);
