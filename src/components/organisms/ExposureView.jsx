import React, { useState, useEffect } from 'react';
import { RiskManagementService } from '../../services/riskManagement.service';
import { Search, RefreshCw } from 'lucide-react';
import { buildActionableErrorState } from '../../utils/errorState';
import ActionableErrorState from '../atoms/ActionableErrorState';

const TAB_BOOK = 'Book';
const TAB_GROUP = 'By Group';
const TAB_ACCOUNT = 'By Account';

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
const pnlColor = (v) => (v > 0 ? 'text-[#4ec9b0]' : v < 0 ? 'text-[#f48771]' : 'text-[color:var(--text-primary)]');

const ExposureView = () => {
  const [tab, setTab] = useState(TAB_BOOK);
  const [bookData, setBookData] = useState([]);
  const [groupData, setGroupData] = useState([]);
  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupInput, setGroupInput] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [loadErrors, setLoadErrors] = useState({ book: null, group: null, account: null });

  const fetchBook = async () => {
    setLoading(true);
    setLoadErrors(prev => ({ ...prev, book: null }));
    try {
      const res = await RiskManagementService.getExposureBook();
      setBookData(Array.isArray(res) ? res : []);
    } catch (err) {
      setBookData([]);
      setLoadErrors(prev => ({
        ...prev,
        book: buildActionableErrorState(err, {
          title: 'Exposure book failed to load',
          actionLabel: 'Refresh',
          fallback: 'Could not load exposure book',
        }),
      }));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBook(); }, []);

  const fetchByGroup = async (e) => {
    e.preventDefault();
    if (!groupInput.trim()) return;
    setLoading(true);
    setLoadErrors(prev => ({ ...prev, group: null }));
    try {
      const res = await RiskManagementService.getExposureByGroup(groupInput.trim());
      setGroupData(Array.isArray(res) ? res : []);
    } catch (err) {
      setGroupData([]);
      setLoadErrors(prev => ({
        ...prev,
        group: buildActionableErrorState(err, {
          title: 'Group exposure failed to load',
          actionLabel: 'Load again',
          fallback: 'Could not load exposure for this group',
        }),
      }));
    }
    finally { setLoading(false); }
  };

  const fetchByAccount = async (e) => {
    e.preventDefault();
    if (!loginInput.trim()) return;
    setLoading(true);
    setLoadErrors(prev => ({ ...prev, account: null }));
    try {
      const res = await RiskManagementService.getExposureByAccount(loginInput.trim());
      setAccountData(res);
    } catch (err) {
      setAccountData(null);
      setLoadErrors(prev => ({
        ...prev,
        account: buildActionableErrorState(err, {
          title: 'Account exposure failed to load',
          actionLabel: 'Load again',
          fallback: 'Could not load exposure for this account',
        }),
      }));
    }
    finally { setLoading(false); }
  };

  const TABS = [TAB_BOOK, TAB_GROUP, TAB_ACCOUNT];

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Book Tab */}
      {tab === TAB_BOOK && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
            <button onClick={fetchBook}
              className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
            {[['Symbol','w-32'],['Long Vol','w-28'],['Short Vol','w-28'],['Net Vol','w-28'],['Net PnL','w-28'],['Long #','w-20'],['Short #','w-20']].map(([l,w]) => (
              <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3`}>{l}</div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
              : loadErrors.book ? <ActionableErrorState state={loadErrors.book} onAction={fetchBook} />
              : bookData.length === 0 ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No exposure data</div>
              : bookData.map((row, i) => (
                <div key={row.symbol} className={`flex items-center px-3 h-[22px] border-b border-black/20 select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                  <div className="w-32 text-[11px] text-[#9cdcfe] pr-3 font-mono">{row.symbol}</div>
                  <div className="w-28 text-[11px] text-[#4ec9b0] pr-3">{fmt(row.long_volume)}</div>
                  <div className="w-28 text-[11px] text-[#f48771] pr-3">{fmt(row.short_volume)}</div>
                  <div className={`w-28 text-[11px] pr-3 ${pnlColor(row.net_volume)}`}>{fmt(row.net_volume)}</div>
                  <div className={`w-28 text-[11px] pr-3 ${pnlColor(row.net_pnl)}`}>{fmt(row.net_pnl)}</div>
                  <div className="w-20 text-[11px] text-[color:var(--text-primary)] pr-3">{row.long_count}</div>
                  <div className="w-20 text-[11px] text-[color:var(--text-primary)]">{row.short_count}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By Group Tab */}
      {tab === TAB_GROUP && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
            <form onSubmit={fetchByGroup} className="flex items-center gap-2">
              <input value={groupInput} onChange={e => setGroupInput(e.target.value)} placeholder="Group name…"
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none w-[180px] focus:border-[color:var(--accent-500)]" />
              <button type="submit"
                className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
                <Search size={11} /> Load
              </button>
            </form>
          </div>
          <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
            {[['Symbol','w-32'],['Long Vol','w-28'],['Short Vol','w-28'],['Net Vol','w-28'],['Net PnL','w-28'],['Long #','w-20'],['Short #','w-20']].map(([l,w]) => (
              <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3`}>{l}</div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
              : loadErrors.group ? <ActionableErrorState state={loadErrors.group} onAction={(event) => fetchByGroup(event)} />
              : groupData.length === 0 ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">Enter a group and click Load</div>
              : groupData.map((row, i) => (
                <div key={row.symbol} className={`flex items-center px-3 h-[22px] border-b border-black/20 select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                  <div className="w-32 text-[11px] text-[#9cdcfe] pr-3 font-mono">{row.symbol}</div>
                  <div className="w-28 text-[11px] text-[#4ec9b0] pr-3">{fmt(row.long_volume)}</div>
                  <div className="w-28 text-[11px] text-[#f48771] pr-3">{fmt(row.short_volume)}</div>
                  <div className={`w-28 text-[11px] pr-3 ${pnlColor(row.net_volume)}`}>{fmt(row.net_volume)}</div>
                  <div className={`w-28 text-[11px] pr-3 ${pnlColor(row.net_pnl)}`}>{fmt(row.net_pnl)}</div>
                  <div className="w-20 text-[11px] text-[color:var(--text-primary)] pr-3">{row.long_count}</div>
                  <div className="w-20 text-[11px] text-[color:var(--text-primary)]">{row.short_count}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By Account Tab */}
      {tab === TAB_ACCOUNT && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
            <form onSubmit={fetchByAccount} className="flex items-center gap-2">
              <input value={loginInput} onChange={e => setLoginInput(e.target.value)} placeholder="Login (account number)…"
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none w-[200px] focus:border-[color:var(--accent-500)]" />
              <button type="submit"
                className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
                <Search size={11} /> Load
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {loading ? <div className="text-[#888] text-[11px]">Loading…</div>
              : loadErrors.account ? <ActionableErrorState state={loadErrors.account} onAction={(event) => fetchByAccount(event)} className="m-0" />
              : !accountData ? <div className="text-[#555] text-[11px]">Enter a login and click Load</div>
              : (
                <div className="flex flex-col gap-4 max-w-[600px]">
                  {/* Account Summary */}
                  <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] p-3 grid grid-cols-3 gap-3">
                    {[
                      ['Login', accountData.login],
                      ['Balance', fmt(accountData.balance)],
                      ['Equity', fmt(accountData.equity)],
                      ['Margin', fmt(accountData.margin)],
                      ['Free Margin', fmt(accountData.margin_free)],
                      ['Margin Level %', fmt(accountData.margin_level)],
                      ['Profit', accountData.profit],
                    ].map(([label, val]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <div className="text-[10px] text-[#888] uppercase tracking-wider">{label}</div>
                        <div className={`text-[12px] font-mono ${label === 'Profit' ? pnlColor(val) : 'text-[color:var(--text-primary)]'}`}>
                          {label === 'Profit' ? fmt(val) : val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Positions */}
                  {Array.isArray(accountData.positions) && accountData.positions.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#888] uppercase tracking-wider mb-1">Open Positions</div>
                      <div className="flex items-center px-2 h-[22px] bg-[color:var(--bg-surface-1)] border border-black/30 rounded-t-[2px]">
                        {[['Ticket','w-24'],['Symbol','w-24'],['Side','w-16'],['Volume','w-20'],['Open','w-24'],['Current','w-24'],['Profit','w-20']].map(([l,w]) => (
                          <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-2`}>{l}</div>
                        ))}
                      </div>
                      {accountData.positions.map((p, i) => (
                        <div key={p.ticket} className={`flex items-center px-2 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
                          <div className="w-24 text-[11px] text-[color:var(--text-primary)] pr-2">{p.ticket}</div>
                          <div className="w-24 text-[11px] text-[#9cdcfe] pr-2 font-mono">{p.symbol}</div>
                          <div className={`w-16 text-[11px] pr-2 ${p.side === 'buy' ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>{p.side}</div>
                          <div className="w-20 text-[11px] text-[color:var(--text-primary)] pr-2">{p.volume}</div>
                          <div className="w-24 text-[11px] text-[color:var(--text-primary)] pr-2 font-mono">{p.price_open}</div>
                          <div className="w-24 text-[11px] text-[color:var(--text-primary)] pr-2 font-mono">{p.price_current}</div>
                          <div className={`w-20 text-[11px] ${pnlColor(p.profit)}`}>{fmt(p.profit)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExposureView;
