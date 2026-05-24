import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Plus, LogOut, ChevronRight, Check, X } from 'lucide-react';

const PROFILE_STYLES = {
  production:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
  staging:     'bg-amber-500/15 text-amber-400 border-amber-500/25',
  development: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

const STATUS_DOT = {
  online:     'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse',
  offline:    'bg-rose-500',
  simulated:  'bg-slate-500',
};

export default function ClusterSidebar({
  clusters        = [],
  activeClusterId = null,
  onSelectCluster,
  onCreateCluster,
  orgName         = 'Organisation',
  userEmail       = '',
  onSignOut,
}) {
  const [creating,     setCreating]     = useState(false);
  const [newName,      setNewName]      = useState('');
  const [createLoading,setCreateLoading]= useState(false);
  const [createError,  setCreateError]  = useState('');

  async function submitCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      await onCreateCluster(name);
      setCreating(false);
      setNewName('');
    } catch (err) {
      setCreateError(err.message || 'Failed to create cluster');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <aside className="w-56 flex-shrink-0 h-screen bg-[#090c13] border-r border-[#1e293b] flex flex-col overflow-hidden">

      {/* ── Org header ───────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
            <Server className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white font-mono truncate">{orgName}</p>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest border border-slate-700 px-1 rounded">
              Free Plan
            </span>
          </div>
        </div>
      </div>

      {/* ── Cluster list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2">
        <p className="px-4 text-[8px] font-mono uppercase tracking-widest text-slate-600 mb-2 font-bold">
          Clusters · {clusters.length}
        </p>

        <AnimatePresence>
          {clusters.map((cluster, i) => {
            const isActive = cluster.id === activeClusterId;
            return (
              <motion.button
                key={cluster.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => onSelectCluster(cluster.id)}
                className={`w-full text-left px-4 py-2.5 transition-all relative group ${
                  isActive
                    ? 'bg-blue-950/30 text-white'
                    : 'text-slate-400 hover:bg-[#0c101b] hover:text-slate-200'
                }`}
              >
                {/* Active left border */}
                {isActive && (
                  <motion.div
                    layoutId="activeBorder"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r"
                  />
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold font-mono truncate">{cluster.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Profile badge */}
                      <span className={`text-[7px] font-mono font-bold uppercase px-1 py-0.5 rounded border ${
                        PROFILE_STYLES[cluster.profile] || PROFILE_STYLES.production
                      }`}>
                        {cluster.profile || 'production'}
                      </span>
                      {/* Status dot */}
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        STATUS_DOT[cluster.status] || STATUS_DOT.simulated
                      }`} />
                      <span className="text-[8px] text-slate-600 font-mono capitalize">
                        {cluster.status || 'simulated'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-3 h-3 flex-shrink-0 mt-1 transition-opacity ${
                    isActive ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-50'
                  }`} />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {clusters.length === 0 && (
          <p className="px-4 text-[9px] text-slate-600 font-mono italic">
            No clusters yet. Create one below.
          </p>
        )}

        {/* ── Create cluster form ──────────────────────────────────────── */}
        <div className="px-3 mt-3">
          <AnimatePresence mode="wait">
            {creating ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={submitCreate}
                className="space-y-1.5 overflow-hidden"
              >
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="cluster-name"
                  maxLength={40}
                  className="w-full bg-[#080b11] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
                {createError && (
                  <p className="text-[8px] text-rose-400 font-mono">{createError}</p>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={createLoading || !newName.trim()}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[9px] font-bold font-mono rounded-lg transition-colors"
                  >
                    {createLoading
                      ? <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                      : <><Check className="w-2.5 h-2.5" /> Create</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }}
                    className="px-2 py-1.5 border border-[#1e293b] hover:border-[#334155] text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 border border-dashed border-[#1e293b] hover:border-blue-500/30 text-slate-500 hover:text-blue-400 rounded-lg transition-all text-[9px] font-mono font-bold uppercase tracking-wider"
              >
                <Plus className="w-3 h-3" /> Add Cluster
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-[#1e293b] space-y-2">
        {userEmail && (
          <p className="text-[9px] text-slate-500 font-mono truncate">{userEmail}</p>
        )}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-rose-950/20 hover:border-rose-500/20 border border-transparent text-slate-500 hover:text-rose-400 rounded-lg transition-all text-[9px] font-mono font-bold uppercase tracking-wider"
        >
          <LogOut className="w-3 h-3" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
