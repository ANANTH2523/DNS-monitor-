import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import AuthPage               from './components/AuthPage';
import PitchPage              from './components/PitchPage';
import ClusterSidebar         from './components/ClusterSidebar';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import { api, tokenStore, checkBackend } from './services/apiService';

// ─── App states ───────────────────────────────────────────────────────────────
// 'loading'   → checking stored token
// 'pitch'     → marketing landing page
// 'auth'      → login / register
// 'dashboard' → main observability UI

export default function App() {
  const [view,            setView]            = useState('loading');
  const [user,            setUser]            = useState(null);
  const [org,             setOrg]             = useState(null);
  const [clusters,        setClusters]        = useState([]);
  const [activeClusterId, setActiveClusterId] = useState(null);
  const [isDemoMode,      setIsDemoMode]      = useState(false);
  const [backendOk,       setBackendOk]       = useState(null);  // null=unknown

  // ── Check backend availability on startup ──────────────────────────────────
  useEffect(() => {
    checkBackend().then(ok => setBackendOk(ok));
  }, []);

  // ── Try to restore session from localStorage ───────────────────────────────
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setView('pitch'); return; }

    api.auth.me()
      .then(data => {
        setUser(data.user);
        setOrg(data.org);
        setClusters(data.clusters || []);
        setActiveClusterId(data.clusters?.[0]?.id || null);
        setView('dashboard');
      })
      .catch(() => {
        tokenStore.clear();
        setView('pitch');
      });
  }, []);  // eslint-disable-line

  // ── Auth callback (login / register success) ──────────────────────────────
  const handleAuth = useCallback((token, userData, orgData, clusterList) => {
    if (!token) {
      // Demo mode
      setIsDemoMode(true);
      setView('dashboard');
      return;
    }
    tokenStore.set(token);
    setUser(userData);
    setOrg(orgData);
    setClusters(clusterList || []);
    setActiveClusterId(clusterList?.[0]?.id || null);
    setIsDemoMode(false);
    setView('dashboard');
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setOrg(null);
    setClusters([]);
    setActiveClusterId(null);
    setIsDemoMode(false);
    setView('pitch');
  }, []);

  // ── Create new cluster ───────────────────────────────────────────────────
  const handleCreateCluster = useCallback(async (name) => {
    const data = await api.clusters.create(name);
    setClusters(prev => [...prev, data.cluster]);
    setActiveClusterId(data.cluster.id);
    return data.cluster;
  }, []);

  // ── Active cluster object ─────────────────────────────────────────────────
  const activeCluster = clusters.find(c => c.id === activeClusterId) || null;

  // ── Loading screen ────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-mono">Initialising DNS Sentinel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 font-sans antialiased selection:bg-blue-500/20 selection:text-blue-200">
      <AnimatePresence mode="wait">

        {/* ── Pitch / Marketing ──────────────────────────────────────────── */}
        {view === 'pitch' && (
          <motion.div key="pitch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <PitchPage onLaunchDashboard={() => setView('auth')} />
          </motion.div>
        )}

        {/* ── Auth page ─────────────────────────────────────────────────── */}
        {view === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AuthPage backendAvailable={backendOk} onAuth={handleAuth} />
          </motion.div>
        )}

        {/* ── Dashboard + Cluster Sidebar ───────────────────────────────── */}
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="flex h-screen overflow-hidden"
          >
            {/* Sidebar — only shown when authenticated (not in demo mode with no clusters) */}
            {(clusters.length > 0 || !isDemoMode) && (
              <ClusterSidebar
                clusters={clusters}
                activeClusterId={activeClusterId}
                onSelectCluster={setActiveClusterId}
                onCreateCluster={handleCreateCluster}
                orgName={org?.name || 'Demo Organisation'}
                userEmail={user?.email || 'demo@dns-sentinel.dev'}
                onSignOut={handleSignOut}
              />
            )}

            {/* Main dashboard */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <ObservabilityDashboard
                clusterId={isDemoMode ? null : activeClusterId}
                clusterName={activeCluster?.name || (isDemoMode ? 'Demo Cluster' : 'No cluster selected')}
                clusterProfile={activeCluster?.profile || 'production'}
                orgName={org?.name || 'Demo Organisation'}
                token={isDemoMode ? null : tokenStore.get()}
                isDemoMode={isDemoMode}
                backendOk={backendOk}
                onGoToAuth={() => setView('auth')}
              />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
