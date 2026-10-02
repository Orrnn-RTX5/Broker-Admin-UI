/* Context and its provider share one lifecycle. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccountsService } from '../services/accounts.service';
import { ManagerService } from '../services/manager.service';
import { useAuthStore } from '../store/authStore';
import { canAccessView } from '../utils/permissions';
import { loadGroupTreePages } from '../utils/groupTreeData';
import { buildWorkspaceMetrics } from '../utils/workspaceMetrics';

const WorkspaceData = createContext(null);
export const useWorkspaceData = () => useContext(WorkspaceData);
export function WorkspaceDataProvider({ children, refreshTrigger = 0 }) {
  const user = useAuthStore(state => state.user);
  const canAccounts = canAccessView(user, 'Trading Accounts');
  const canPositions = canAccessView(user, 'Positions');
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState({ accounts: [], positions: [], updatedAt: null, errors: {}, loading: true });
  const [journal, setJournal] = useState([]);
  const recordEvent = useCallback((message, tone = 'info') => {
    setJournal(rows => [{ id: crypto.randomUUID(), time: new Date().toISOString(), source: 'Admin workspace', message, tone }, ...rows].slice(0, 150));
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const run = generation.current;
    setSnapshot(value => ({ ...value, loading: true }));
    const results = await Promise.allSettled([
      canAccounts ? AccountsService.getAllAccounts() : Promise.reject(new Error('Account access is restricted')),
      canPositions ? loadGroupTreePages(({ page, limit }) => ManagerService.getPositionsAll(page, limit), { arrayKeys: ['positions', 'data', 'answer', 'items', 'rows'] }) : Promise.reject(new Error('Position access is restricted')),
    ]);
    if (run !== generation.current) return;
    const errors = {};
    ['accounts', 'positions'].forEach((key, i) => { if (results[i].status === 'rejected') errors[key] = results[i].reason?.message || 'Could not load ' + key; });
    setSnapshot({ accounts: results[0].status === 'fulfilled' ? results[0].value : [], positions: results[1].status === 'fulfilled' ? results[1].value : [], errors, loading: false, updatedAt: Date.now() });
    recordEvent(Object.keys(errors).length ? 'Snapshot updated with unavailable data: ' + Object.keys(errors).join(', ') : 'Account and position snapshot refreshed', Object.keys(errors).length ? 'warning' : 'info');
    inFlight.current = false;
  }, [canAccounts, canPositions, recordEvent]);
  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); generation.current += 1; inFlight.current = false; };
  }, [refresh, refreshTrigger]);
  const metrics = useMemo(
    () => buildWorkspaceMetrics(snapshot.accounts, snapshot.positions),
    [snapshot.accounts, snapshot.positions],
  );
  return <WorkspaceData.Provider value={{ ...snapshot, metrics, refresh, journal, recordEvent }}>{children}</WorkspaceData.Provider>;
}
