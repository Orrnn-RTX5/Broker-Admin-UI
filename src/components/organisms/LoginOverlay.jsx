import React, { useState } from 'react';
import { AuthService } from '../../services/auth.service';

export default function LoginOverlay({ onLoginSuccess }) {
  const [user, setUser] = useState('10007');
  const [password, setPassword] = useState('Manager@123');
  const [server, setServer] = useState('69.197.178.27');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await AuthService.login(user, password, server);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#1e1e1e] flex items-center justify-center font-sans select-none">
      <div className="w-[350px] bg-[#252526] border border-black/50 shadow-2xl rounded-[3px] overflow-hidden">
        {/* Header */}
        <div className="h-8 bg-[#333333] border-b border-black/40 flex items-center px-3">
          <span className="text-[12px] font-medium text-[#e1e1e1]">RTX5 Manager Login</span>
        </div>
        
        {/* Body */}
        <div className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaaaaa]">Login / Account</label>
              <input 
                type="text" 
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="h-7 bg-[#1e1e1e] border border-[#3e3e42] text-[#e1e1e1] text-[12px] px-2 outline-none focus:border-[#007acc]"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaaaaa]">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-7 bg-[#1e1e1e] border border-[#3e3e42] text-[#e1e1e1] text-[12px] px-2 outline-none focus:border-[#007acc]"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaaaaa]">Server</label>
              <input 
                type="text" 
                value={server}
                onChange={(e) => setServer(e.target.value)}
                className="h-7 bg-[#1e1e1e] border border-[#3e3e42] text-[#e1e1e1] text-[12px] px-2 outline-none focus:border-[#007acc]"
                required
              />
            </div>

            {error && (
              <div className="text-[11px] text-red-400 mt-1">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="mt-4 h-8 bg-[#007acc] hover:bg-[#0098ff] text-white text-[12px] font-medium rounded-[2px] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
