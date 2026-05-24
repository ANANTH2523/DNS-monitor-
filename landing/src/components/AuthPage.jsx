import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, Layers, Server, Lock, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { api, tokenStore, checkBackend } from '../services/apiService';

const FEATURES = [
  { icon: Shield,   title: 'Zero Instrumentation',    desc: 'No code changes to your application.' },
  { icon: Layers,   title: 'Multi-Tenant Isolation',  desc: 'Each cluster has its own data stream.' },
  { icon: Activity, title: 'Real-Time WebSocket',     desc: 'Live DNS events pushed to your dashboard.' },
  { icon: Server,   title: 'Kubernetes Native',        desc: 'Sidecar pattern — works with any cluster.' },
];

export default function AuthPage({ backendAvailable, onAuth }) {
  const [mode,        setMode]        = useState('login');   // 'login' | 'register'
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [orgName,     setOrgName]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [backendOk,   setBackendOk]   = useState(backendAvailable);

  useEffect(() => {
    if (backendAvailable === null) {
      checkBackend().then(ok => setBackendOk(ok));
    } else {
      setBackendOk(backendAvailable);
    }
  }, [backendAvailable]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!orgName.trim()) { setError('Organisation name is required'); setLoading(false); return; }
        const data = await api.auth.register(email, password, orgName);
        tokenStore.set(data.token);
        onAuth(data.token, data.user, data.org, [data.cluster]);
      } else {
        const data = await api.auth.login(email, password);
        tokenStore.set(data.token);
        onAuth(data.token, data.user, data.org, data.clusters);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  function handleDemoMode() {
    onAuth(null, null, null, null);
  }

  return (
    <div className="min-h-screen bg-[#080b11] flex items-stretch">

      {/* ── Left: Brand panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#090c13] border-r border-[#1e293b] p-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-bold text-white font-mono">DNS Sentinel</span>
          </div>

          <h2 className="text-2xl font-black text-white mb-2 leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Real-Time DNS Observability<br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              for Kubernetes
            </span>
          </h2>
          <p className="text-sm text-slate-400 font-light mb-10 leading-relaxed">
            Monitor every DNS query across your clusters. Detect anomalies. Get alerted on failures. All in real-time.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.2 }}
                className="flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">{title}</p>
                  <p className="text-[10px] text-slate-500 font-light">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Backend status */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-[10px] font-mono ${
          backendOk
            ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-950/30 border-amber-500/20 text-amber-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {backendOk
            ? 'Backend connected — live data mode available'
            : 'Backend offline — demo mode available'}
        </div>
      </div>

      {/* ── Right: Auth form ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white font-mono text-sm">DNS Sentinel</span>
          </div>

          <h1 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-xs text-slate-400 mb-6 font-light">
            {mode === 'login'
              ? 'Sign in to access your clusters and telemetry.'
              : 'Start monitoring DNS in under 2 minutes.'}
          </p>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-[#0c101b] border border-[#1e293b] rounded-lg mb-5">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-wider transition-all ${
                  mode === m
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1 block">
                  Organisation Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  className="w-full bg-[#0c101b] border border-[#1e293b] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-colors font-mono"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-[#0c101b] border border-[#1e293b] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-[#0c101b] border border-[#1e293b] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-rose-950/30 border border-rose-500/20 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-300 font-mono">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !backendOk}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#1e293b]" />
            <span className="text-[9px] text-slate-600 font-mono uppercase">or</span>
            <div className="flex-1 h-px bg-[#1e293b]" />
          </div>

          {/* Demo mode */}
          <button
            onClick={handleDemoMode}
            className="w-full py-2.5 border border-[#1e293b] hover:border-[#334155] text-slate-300 hover:text-white font-medium text-sm rounded-lg transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Try Demo Mode (no account needed)
            </span>
          </button>

          <p className="text-center text-[9px] text-slate-600 mt-4 font-mono leading-relaxed">
            Demo mode uses simulated DNS data in your browser.<br />
            No backend required. No account needed.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
