import React from 'react';

export const ToastCtx = React.createContext(null);

export const useToast = () => {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
