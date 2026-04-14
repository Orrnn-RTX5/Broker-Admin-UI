import { create } from 'zustand';

/**
 * Connection health signal. The axios response interceptor flips `status`
 * to 'error' on failure and back to 'ok' on success. The footer reads
 * from here.
 */
export const useConnectionStore = create((set) => ({
  status: 'ok',     // 'ok' | 'error' | 'idle'
  lastError: null,  // last error message
  markOk: () => set({ status: 'ok', lastError: null }),
  markError: (msg) => set({ status: 'error', lastError: msg || 'Request failed' }),
}));
