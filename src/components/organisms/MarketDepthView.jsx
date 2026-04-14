import React, { useState } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Search, Save, Database, AlertCircle, Check, Plus } from 'lucide-react';

const MarketDepthView = () => {
  const [searchSymbol, setSearchSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  const [config, setConfig] = useState(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchSymbol.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setNotFound(false);
    setConfig(null);

    try {
      const res = await ManagerService.getMarketDepthConfig(searchSymbol.trim());
      let parsedConfig = res;
      if (res && res.data) parsedConfig = res.data;
      
      if (parsedConfig && parsedConfig.symbol) {
        setConfig(parsedConfig);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      if (err.response?.status === 404) {
         setNotFound(true);
      } else {
         const msg = err.response?.data?.error || err.response?.data?.message || err.message;
         setError(msg || 'Failed to fetch Market Depth Config');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setNotFound(false);
    setConfig({
      symbol: searchSymbol.trim(),
      aggregation: 'none',
      depth_levels: 5,
      enabled: true,
      spread_markup: 0,
      volume_filter: 0.0
    });
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        symbol: config.symbol || searchSymbol.trim(),
        aggregation: config.aggregation,
        depth_levels: Number(config.depth_levels),
        enabled: Boolean(config.enabled),
        spread_markup: Number(config.spread_markup),
        volume_filter: Number(config.volume_filter)
      };

      await ManagerService.setMarketDepthConfig(payload);
      setSuccess(true);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative">
      {/* Top Action Bar */}
      <div className="flex flex-col border-b border-black/40 bg-[color:var(--bg-surface-1)] shrink-0 p-4 gap-4">
        
        <div className="flex items-center gap-2">
            <Database size={16} className="text-blue-400" />
            <h2 className="text-[color:var(--text-primary)] text-[14px] font-medium tracking-wide">Market Depth Configuration</h2>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="flex border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] h-[26px] items-center text-[color:var(--text-muted)] rounded-[2px] w-[300px]">
            <div className="px-2"><Search size={12} /></div>
            <input
              type="text"
              required
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              placeholder="Enter Symbol (e.g. EURUSD)"
              className="bg-transparent border-none outline-none w-full text-[12px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] h-full"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="flex items-center justify-center h-[26px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[12px] rounded-[2px] transition-colors disabled:opacity-50 min-w-[70px]"
          >
            {loading ? '...' : 'Load'}
          </button>
        </form>

        {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-2 rounded-sm text-red-400 text-[12px] max-w-[500px]">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="leading-tight">{error}</span>
            </div>
        )}
        
        {success && (
            <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 p-2 rounded-sm text-green-400 text-[12px] max-w-[500px]">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span className="leading-tight">Configuration saved successfully!</span>
            </div>
        )}
      </div>

      {/* Configuration Form Body */}
      <div className="flex-1 overflow-auto bg-[color:var(--bg-app)] p-6">
        
        {!config && !notFound && !loading && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
              <Database size={64} className="mb-4 text-[#888]" />
              <p className="text-[14px]">Search a symbol to view or edit its Market Depth configuration</p>
          </div>
        )}

        {notFound && !config && (
          <div className="flex flex-col items-center justify-center h-full select-none gap-4">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <Database size={48} className="text-[#888]" />
              <p className="text-[13px] text-[color:var(--text-muted)]">No configuration found for <span className="text-white font-medium">{searchSymbol}</span></p>
            </div>
            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-2 h-[28px] px-5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[12px] rounded-[2px] transition-colors"
            >
              <Plus size={13} />
              Create Config for {searchSymbol}
            </button>
          </div>
        )}

        {config && (
          <div className="max-w-[600px] flex flex-col gap-6">
            <h3 className="text-[color:var(--text-secondary)] text-[13px] border-b border-[#333] pb-2 font-medium">
              Configuring: <span className="text-white">{config.symbol}</span>
              {config.id && <span className="ml-2 text-[#666] text-[11px]">ID: {config.id}</span>}
            </h3>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-muted)] text-[11px] uppercase tracking-wider">Aggregation Type</label>
                <input
                  type="text"
                  name="aggregation"
                  value={config.aggregation ?? ''}
                  onChange={handleChange}
                  placeholder="none"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 text-[12px] focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-muted)] text-[11px] uppercase tracking-wider">Depth Levels</label>
                <input
                  type="number"
                  name="depth_levels"
                  value={config.depth_levels ?? 5}
                  onChange={handleChange}
                  min="0"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 text-[12px] focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-muted)] text-[11px] uppercase tracking-wider">Spread Markup (pts)</label>
                <input
                  type="number"
                  name="spread_markup"
                  value={config.spread_markup ?? 0}
                  onChange={handleChange}
                  step="1"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 text-[12px] focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-muted)] text-[11px] uppercase tracking-wider">Volume Filter</label>
                <input
                  type="number"
                  name="volume_filter"
                  value={config.volume_filter ?? 0}
                  onChange={handleChange}
                  step="0.01"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 text-[12px] focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 mt-2 col-span-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={Boolean(config.enabled)}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#444] rounded-full peer peer-checked:bg-[color:var(--accent-500)] peer-focus:ring-2 peer-focus:ring-blue-800 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
                <span className="text-[12px] text-[color:var(--text-primary)] font-medium">Market Depth Enabled</span>
              </div>
            </div>

            <div className="mt-4">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 h-[28px] px-6 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[12px] rounded-[2px] transition-colors disabled:opacity-50"
              >
                <Save size={13} />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default MarketDepthView;
