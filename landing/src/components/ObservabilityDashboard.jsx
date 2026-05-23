import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Clock, Activity, AlertTriangle, Terminal, BarChart3,
  RefreshCw, Lock, Download, AlertOctagon, Info, Wifi, WifiOff,
  Server, Zap, Database
} from 'lucide-react';

import { useTelemetry }      from '../services/telemetryService';
import LightweightIntro      from './LightweightIntro';
import MetricCard            from './MetricCard';
import LatencyPercentiles    from './LatencyPercentiles';
import LiveQueryFeed         from './LiveQueryFeed';
import IncidentTimeline      from './IncidentTimeline';
import ThreatAlerts          from './ThreatAlerts';
import ArchitectureMap       from './ArchitectureMap';
import ClusterHealth         from './ClusterHealth';
import DnsTypeChart          from './DnsTypeChart';
import QueryHeatmap          from './QueryHeatmap';

// ─── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',        Icon: BarChart3  },
  { id: 'stream',    label: 'Live DNS Feed',    Icon: Terminal   },
  { id: 'security',  label: 'Security SIEM',   Icon: Lock       },
  { id: 'infra',     label: 'Infrastructure',  Icon: Server     },
];

export default function ObservabilityDashboard() {
  const [showIntro,         setShowIntro]         = useState(true);
  const [activeTab,         setActiveTab]         = useState('overview');
  const [isRefreshing,      setIsRefreshing]      = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('5m');
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);

  // Telemetry hook
  const {
    connectionStatus,
    metrics,
    logs,
    incidents,
    threats,
    pods,
    latencyHistory,
    qpsHistory,
    recordTypeStats,
    heatmapData,
    setThreats,
    setHealthScore,
    forceDisconnect,
    manualReconnect,
    floatingAlerts,
    setFloatingAlerts,
    triggerFloatingAlert,
  } = useTelemetry();

  // Mitigation states
  const [remediatingThreatId, setRemediatingThreatId] = useState(null);
  const [quarantinedPods,     setQuarantinedPods]     = useState([]);
  const [decodedPayload,      setDecodedPayload]      = useState(null);
  const [quarantineTerminal,  setQuarantineTerminal]  = useState('');

  // ── Top domains (live-computed from logs) ────────────────────────────────
  const topDomains = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      if (!map[log.domain]) map[log.domain] = { name: log.domain, count: 0, ok: 0, latencies: [] };
      map[log.domain].count++;
      if (log.status === 'OK') map[log.domain].ok++;
      map[log.domain].latencies.push(log.latency);
    });
    return Object.values(map)
      .map(d => ({
        name:        d.name,
        count:       d.count,
        successRate: d.count ? Math.round((d.ok / d.count) * 100) : 100,
        latency:     d.latencies.length
          ? `${Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length)}ms`
          : '0ms',
        error: d.count ? Math.round((d.ok / d.count) * 100) < 90 : false,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [logs]);

  // ── Bezier SVG latency chart ─────────────────────────────────────────────
  const svgChartPath = useMemo(() => {
    const W = 640, H = 140, P = 10;
    const xStep = (W - P * 2) / (latencyHistory.length - 1);
    const pts = latencyHistory.map((v, i) => ({
      x: P + i * xStep,
      y: H - P - (v / 50) * (H - P * 2),
    }));
    if (!pts.length) return { line: '', area: '' };
    const line = pts.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      return `C ${prev.x + (p.x - prev.x) / 3} ${prev.y}, ${prev.x + 2 * (p.x - prev.x) / 3} ${p.y}, ${p.x} ${p.y}`;
    }).join(' ');
    const last = pts[pts.length - 1];
    const area = `${line} L ${last.x} ${H - P} L ${pts[0].x} ${H - P} Z`;
    return { line, area };
  }, [latencyHistory]);

  // ── QPS sparkline bars ───────────────────────────────────────────────────
  const qpsMax = useMemo(() => Math.max(...qpsHistory, 0.1), [qpsHistory]);

  // ── Export handlers ──────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Namespace', 'Pod', 'Domain', 'Type', 'Latency(ms)', 'RCODE', 'Status'];
    const rows    = logs.map(q => [q.ts, q.namespace, q.pod, q.domain, q.type, q.latency, q.rcode, q.status]);
    const csv     = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    triggerDownload(csv, `dns_sentinel_logs_${today()}.csv`, 'text/csv;charset=utf-8;');
  }, [logs]);

  const handleExportJSON = useCallback(() => {
    triggerDownload(JSON.stringify(incidents, null, 2), `dns_sentinel_incidents_${today()}.json`, 'application/json;charset=utf-8;');
  }, [incidents]);

  const handleExportReport = useCallback(() => {
    const ts    = new Date().toLocaleString();
    const html  = buildHtmlReport(ts, metrics, threats, quarantinedPods);
    triggerDownload(html, `dns_sentinel_report_${today()}.html`, 'text/html;charset=utf-8;');
    triggerFloatingAlert('info', 'Report Generated', 'DNS incident report downloaded successfully.');
  }, [metrics, threats, quarantinedPods, triggerFloatingAlert]);

  // ── Mitigation handlers ──────────────────────────────────────────────────
  const handleQuarantinePod = useCallback((threat) => {
    setRemediatingThreatId(threat.id);
    setQuarantineTerminal(`root@dns-sentinel:~# isolating network namespace for pod ${threat.source}...`);
    const steps = [
      `\nExecuting: kubectl label pod ${threat.source.endsWith('.5') ? 'payment-service-6f8' : 'auth-manager-3b2'} sentinel-quarantine=true --namespace=production`,
      `\nApplying Kubernetes NetworkPolicy: dns-sentinel-isolate-namespace`,
      `\n[ SUCCESS ] Network namespace restricted. SDN egress exfiltration blocked.`,
    ];
    steps.forEach((s, i) => setTimeout(() => setQuarantineTerminal(prev => prev + s), (i + 1) * 600));
    setTimeout(() => {
      setRemediatingThreatId(null);
      setQuarantinedPods(prev => [...prev, threat.id]);
      setHealthScore(prev => Math.min(99.9, prev + 0.4));
      triggerFloatingAlert('info', 'Remediation Succeeded', `Pod ${threat.source} quarantined.`);
      setThreats(prev => prev.map(t =>
        t.id === threat.id ? { ...t, title: 'RESOLVED (QUARANTINED)', desc: 'Pod isolated from network namespace.' } : t
      ));
    }, 2400);
  }, [setHealthScore, setThreats, triggerFloatingAlert]);

  const handleDecodePayload = useCallback((threat) => {
    setDecodedPayload({
      raw:     'c2VjcmV0LWNvbmZpZy1kYi1wYXNzd29yZD1zdXBlcmFkbWluMTIz',
      decoded: 'secret-config-db-password=superadmin123 (Leak Neutralized)',
      source:  threat.source,
    });
  }, []);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // ── Early return: boot intro ──────────────────────────────────────────────
  if (showIntro) return <LightweightIntro onComplete={() => setShowIntro(false)} />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col min-h-screen text-[#e2e8f0] bg-[#080b11] font-sans antialiased overflow-hidden select-none">

      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-observability opacity-30 pointer-events-none z-0" />
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-glow-observability opacity-20 pointer-events-none z-0" />

      {/* ── TOP NAV ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-[#1e293b] bg-[#0c101b] shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1e293b] border border-[#334155] flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white uppercase">DNS Sentinel</span>
              <p className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold">eBPF CORE OBSERVABILITY</p>
            </div>
            {/* Connection badge */}
            {connectionStatus === 'connected' ? (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-status-pulse" /> Agent: connected
              </div>
            ) : (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/20 text-[9px] font-mono text-rose-400 font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> Agent: disconnected
              </div>
            )}
          </div>

          {/* Desktop tab nav */}
          <nav className="hidden md:flex bg-[#0f1422] border border-[#1e293b] rounded-md p-0.5 font-mono text-[11px] font-bold">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                  activeTab === id
                    ? 'bg-[#182035] text-blue-400 border border-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 rounded bg-[#0f1422] border border-[#1e293b] text-slate-400"
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>

            {/* Disconnect / Reconnect */}
            {connectionStatus === 'connected' ? (
              <button onClick={forceDisconnect} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-colors">
                <WifiOff className="w-3 h-3" /> Disconnect
              </button>
            ) : (
              <button onClick={manualReconnect} className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/20 border border-rose-500/30 text-[10px] font-mono text-rose-400 hover:bg-rose-950/40 transition-colors">
                <Wifi className="w-3 h-3" /> Reconnect
              </button>
            )}

            {/* Time range selector */}
            <div className="hidden sm:flex items-center bg-[#080b11] border border-[#1e293b] rounded px-2.5 py-1 text-slate-400">
              <Clock className="w-3 h-3 text-slate-500 mr-1.5" />
              <select
                value={selectedTimeRange}
                onChange={e => { setSelectedTimeRange(e.target.value); triggerRefresh(); }}
                className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer text-[10px] font-mono"
              >
                <option value="5m">Last 5m</option>
                <option value="15m">Last 15m</option>
                <option value="1h">Last 1h</option>
                <option value="6h">Last 6h</option>
              </select>
            </div>

            {/* Refresh */}
            <button onClick={triggerRefresh} className="p-1.5 rounded bg-[#080b11] border border-[#1e293b] text-slate-400 hover:text-blue-400 transition-colors">
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile drop-down nav */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-[#1e293b] bg-[#0c101b] px-4 pb-3 overflow-hidden"
            >
              <div className="flex flex-col gap-1 pt-2 font-mono text-[11px] font-bold">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded transition-all text-left ${
                      activeTab === id ? 'bg-[#182035] text-blue-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN CANVAS ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 overflow-y-auto">

        {/* Outage skeleton */}
        {connectionStatus !== 'connected' ? (
          <div className="h-full flex flex-col justify-center items-center py-20 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/20 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white font-mono">eBPF Telemetry Outage Detected</h3>
              <p className="text-xs text-slate-500 font-light max-w-sm">Lost active BPF socket connection to KIND cluster control-plane.</p>
            </div>
            <button onClick={manualReconnect} className="px-4 py-2 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-xs font-mono font-bold rounded transition-colors">
              Retry Connection
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ══ TAB: OVERVIEW ════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">

                {/* Hero banner */}
                <div className="p-5 rounded-lg bg-[#0c101b] border border-[#1e293b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-blue-500 font-bold">Kubernetes Observability Node</span>
                    <h2 className="text-lg font-bold tracking-tight text-white">BPF DNS Resolving Telemetry</h2>
                    <p className="text-xs text-slate-400 leading-normal max-w-2xl font-light">
                      Intercepting DNS resolve timings on raw sockets at interface <code className="text-blue-400 bg-blue-950/20 px-1 rounded">eth0</code>.
                      Live charts measure p50/p95/p99 timeouts to identify service performance spikes and security indicators.
                    </p>
                  </div>
                  <button onClick={handleExportReport} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e293b] bg-[#080b11] hover:bg-[#1a202c] hover:border-[#334155] text-slate-400 hover:text-white rounded transition-colors text-[9px] font-mono font-bold self-end sm:self-auto">
                    <Download className="w-3 h-3 text-blue-400" /> Download Incident Report
                  </button>
                </div>

                {/* ── 5-card metrics row ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <MetricCard title="Total Volume"        value={metrics.totalQueries.toLocaleString()} desc="Scraped live from core controller" />
                  <MetricCard title="Resolving Failures"  value={metrics.failures.toLocaleString()} isError={metrics.failureRate > 2} desc={`Error index: ${metrics.failureRate}%`} />
                  <MetricCard title="Request Throughput"  value={metrics.throughput} unit="req/s" desc="UDP resolver traffic load" />
                  <MetricCard title="Cache Hit Rate"      value={metrics.cacheHitRate} unit="%" desc="CoreDNS cached responses" icon={Database} />
                  <MetricCard title="Cluster Health"      value={metrics.healthScore} unit="%" desc="eBPF capture checks operational" icon={Activity} />
                </div>

                {/* ── Latency chart + percentiles ───────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* SVG latency area chart */}
                  <div className="lg:col-span-2 bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">Live Timing Analytics</span>
                        <h3 className="text-xs font-bold text-slate-200 mt-0.5">p95 Latency Index Timeline</h3>
                      </div>
                      <span className="text-[8px] font-mono text-blue-400 bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase">Real-Time</span>
                    </div>
                    <div className="w-full h-[140px] relative overflow-hidden">
                      <svg width="100%" height="140" style={{ overflow: 'visible' }}>
                        {[10, 50, 90, 130].map(y => (
                          <line key={y} x1="0" y1={y} x2="100%" y2={y} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="4 4" />
                        ))}
                        <path d={svgChartPath.area} fill="rgba(59,130,246,0.05)" stroke="none" className="transition-all duration-300" />
                        <path d={svgChartPath.line} fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" className="transition-all duration-300" />
                        {latencyHistory.length > 0 && (
                          <circle
                            cx={10 + (latencyHistory.length - 1) * (620 / (latencyHistory.length - 1))}
                            cy={140 - 10 - (latencyHistory[latencyHistory.length - 1] / 50) * 120}
                            r="3" fill="#60a5fa"
                          />
                        )}
                      </svg>
                      <div className="absolute left-0 top-2 text-[8px] font-mono text-slate-600 space-y-7 pointer-events-none select-none w-6 text-right">
                        <p>50ms</p><p>30ms</p><p>10ms</p><p>0ms</p>
                      </div>
                    </div>

                    {/* QPS sparkline bars */}
                    <div className="mt-4 pt-3 border-t border-[#1e293b]/40">
                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-wider">QPS Throughput (30s window)</span>
                      <div className="flex items-end gap-0.5 mt-1.5 h-8">
                        {qpsHistory.map((v, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm transition-all duration-500"
                            style={{
                              height:          `${(v / qpsMax) * 100}%`,
                              backgroundColor: i === qpsHistory.length - 1 ? '#3b82f6' : '#1e3a5f',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Latency percentiles */}
                  <LatencyPercentiles percentiles={metrics.latencyPercentiles} />
                </div>

                {/* ── DNS type chart + heatmap ───────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <DnsTypeChart recordTypeStats={recordTypeStats} />
                  <div className="lg:col-span-2">
                    <QueryHeatmap heatmapData={heatmapData} />
                  </div>
                </div>

                {/* ── RCODE breakdown + top domains ─────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* RCODE bars */}
                  <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider block mb-4">RCODE Error Breakdown</span>
                      <div className="space-y-4 font-mono text-[10px]">
                        {[
                          { label: 'NXDOMAIN (No Such Domain)',  pct: 62.8, color: 'bg-amber-500', text: 'text-amber-500' },
                          { label: 'SERVFAIL (Resolver Outage)', pct: 32.4, color: 'bg-rose-500',  text: 'text-rose-500'  },
                          { label: 'REFUSED (Firewall Block)',   pct: 4.8,  color: 'bg-slate-500', text: 'text-slate-500' },
                        ].map(({ label, pct, color, text }) => (
                          <div key={label} className="space-y-1">
                            <div className="flex justify-between items-center text-slate-400">
                              <span>{label}</span>
                              <span className={text}>{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#1a202c] rounded overflow-hidden">
                              <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[#1e293b]/40 pt-3 mt-4 text-[9px] text-slate-500 font-mono">
                      💡 NXDOMAIN anomalies signify search path redundancy timings.
                    </div>
                  </div>

                  {/* Top queried domains */}
                  <div className="lg:col-span-2 bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm">
                    <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-4 block">Top Resolving Targets</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[10px] text-slate-300">
                        <thead>
                          <tr className="border-b border-[#1e293b] text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                            <th className="pb-3">Domain</th>
                            <th className="pb-3 text-right">Volume</th>
                            <th className="pb-3 text-right">Success</th>
                            <th className="pb-3 text-right">Avg Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]/40">
                          {topDomains.map((d, i) => (
                            <tr key={i} className="hover:bg-[#121824]/40 transition-colors">
                              <td className={`py-3 ${d.error ? 'text-rose-400 font-semibold' : 'text-slate-200 font-medium'}`}>{d.name}</td>
                              <td className="py-3 text-right">{d.count.toLocaleString()}</td>
                              <td className="py-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  d.successRate > 95 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950/40 text-rose-400 border border-rose-500/20'
                                }`}>{d.successRate}%</span>
                              </td>
                              <td className="py-3 text-right text-slate-400">{d.latency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ══ TAB: LIVE DNS FEED ══════════════════════════════════════════ */}
            {activeTab === 'stream' && (
              <motion.div key="stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <LiveQueryFeed logs={logs} onExportCSV={handleExportCSV} />
              </motion.div>
            )}

            {/* ══ TAB: SECURITY SIEM ══════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ThreatAlerts
                      threats={threats}
                      threatScore={metrics.threatScore}
                      remediatingThreatId={remediatingThreatId}
                      quarantineTerminal={quarantineTerminal}
                      quarantinedPods={quarantinedPods}
                      onQuarantine={handleQuarantinePod}
                      onDecode={handleDecodePayload}
                      onMute={(threat) => {
                        setThreats(prev => prev.filter(t => t.id !== threat.id));
                        triggerFloatingAlert('info', 'Alert Dismissed', 'Warning cleared from SIEM console.');
                      }}
                    />
                  </div>
                  <IncidentTimeline incidents={incidents} onExportJSON={handleExportJSON} />
                </div>
                <ArchitectureMap />
              </motion.div>
            )}

            {/* ══ TAB: INFRASTRUCTURE ════════════════════════════════════════ */}
            {activeTab === 'infra' && (
              <motion.div key="infra" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">

                {/* Infra hero */}
                <div className="p-5 rounded-lg bg-[#0c101b] border border-[#1e293b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-blue-500 font-bold">Cluster Node Registry</span>
                    <h2 className="text-lg font-bold tracking-tight text-white">Kubernetes Infrastructure View</h2>
                    <p className="text-xs text-slate-400 leading-normal max-w-2xl font-light">
                      Live pod health matrix scraped via eBPF sidecar probes. Hover over pods to inspect DNS query distributions,
                      restart counts, and resource utilization.
                    </p>
                  </div>
                  {/* Cluster-wide stats */}
                  <div className="flex gap-4 font-mono text-center text-[10px]">
                    {[
                      { label: 'Total Pods', value: pods.length, color: 'text-white' },
                      { label: 'Running',    value: pods.filter(p => p.status === 'Running').length, color: 'text-emerald-400' },
                      { label: 'Warning',    value: pods.filter(p => p.status === 'Warning').length, color: 'text-amber-400' },
                      { label: 'Failed',     value: pods.filter(p => p.status === 'CrashLoopBackOff').length, color: 'text-rose-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#080b11] border border-[#1e293b] rounded px-3 py-2">
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-slate-500 text-[8px] uppercase tracking-wider mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pod health grid */}
                <ClusterHealth pods={pods} />

                {/* Pod DNS query ranking */}
                <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm">
                  <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-4 block">Pod DNS Query Ranking</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px] text-slate-300">
                      <thead>
                        <tr className="border-b border-[#1e293b] text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                          <th className="pb-3">#</th>
                          <th className="pb-3">Pod</th>
                          <th className="pb-3">Namespace</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">DNS Queries</th>
                          <th className="pb-3 text-right">CPU</th>
                          <th className="pb-3 text-right">Memory</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e293b]/40">
                        {[...pods].sort((a, b) => b.dnsQueries - a.dnsQueries).map((pod, i) => (
                          <tr key={pod.id} className="hover:bg-[#121824]/40 transition-colors">
                            <td className="py-2.5 text-slate-600 font-bold">{i + 1}</td>
                            <td className="py-2.5 text-slate-200 font-medium">{pod.name}</td>
                            <td className="py-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-[#080b11] border border-[#1e293b] text-slate-400 text-[8px]">{pod.namespace}</span>
                            </td>
                            <td className="py-2.5">
                              <span className={`text-[8px] font-bold uppercase ${
                                pod.status === 'Running' ? 'text-emerald-400' :
                                pod.status === 'Warning' ? 'text-amber-400' : 'text-rose-400'
                              }`}>{pod.status}</span>
                            </td>
                            <td className="py-2.5 text-right text-blue-400 font-semibold">{pod.dnsQueries.toLocaleString()}</td>
                            <td className={`py-2.5 text-right ${parseInt(pod.cpu) > 70 ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>{pod.cpu}</td>
                            <td className="py-2.5 text-right text-slate-400">{pod.mem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1e293b] bg-[#0c101b] px-6 py-4 text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-bold text-slate-400">DNS Sentinel Core v2.0.0</span>
        </div>
        <p className="text-center">Kubernetes BPF logs streaming active · Scrape Interval: 2.5s · Context: kind-kind · No API Keys Required</p>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Secure Observability Profile
        </div>
      </footer>

      {/* ── FLOATING TOAST ALERTS ────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {floatingAlerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="p-4 border border-[#1e293b] bg-[#0c101b]/95 backdrop-blur shadow-lg rounded-lg pointer-events-auto flex items-start gap-3 w-80 font-mono text-[10px]"
            >
              <div className="mt-0.5">
                {alert.type === 'critical' ? <AlertOctagon className="w-4 h-4 text-rose-500 animate-pulse" /> :
                 alert.type === 'warning'  ? <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" /> :
                                             <Info className="w-4 h-4 text-blue-400" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase">
                  <span>TELEMETRY NOTIFICATION</span>
                </div>
                <h4 className="text-xs font-bold text-white font-sans">{alert.title}</h4>
                <p className="text-slate-400 leading-normal font-sans font-light">{alert.desc}</p>
              </div>
              <button onClick={() => setFloatingAlerts(prev => prev.filter(a => a.id !== alert.id))} className="text-slate-500 hover:text-white transition-colors font-sans text-xs">✕</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── PAYLOAD INSPECTOR MODAL ──────────────────────────────────────────── */}
      {decodedPayload && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-xl font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 uppercase tracking-widest text-[9px]">eBPF Payload Decoder</span>
              </div>
              <button onClick={() => setDecodedPayload(null)} className="text-slate-500 hover:text-white transition-colors text-xs font-bold font-sans">✕ Close</button>
            </div>
            <div className="space-y-4 text-[10px] leading-relaxed">
              <p className="text-slate-400">Raw base64 packet payload captured from network interface:</p>
              <div className="bg-[#080b11] border border-[#1e293b] rounded p-2.5 text-rose-400 break-all select-all font-semibold">{decodedPayload.raw}</div>
              <div className="py-1.5 px-3 rounded bg-blue-950/20 border border-blue-500/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <p className="text-[9px] text-blue-300 font-bold uppercase tracking-wider">Decoded DNS label stream:</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold mb-1">DECRYPTED TX RECORD:</p>
                <div className="bg-[#080b11] border border-blue-500/25 rounded p-2.5 text-emerald-400 text-xs font-bold break-all shadow-inner">{decodedPayload.decoded}</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildHtmlReport(timestamp, metrics, threats, quarantinedPods) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DNS Sentinel — Incident Report</title>
  <style>
    body { font-family: 'Courier New', monospace; background: #fff; color: #1e293b; padding: 40px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
    .meta { font-size: 10px; color: #64748b; margin-top: 5px; }
    .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; background: #f1f5f9; padding: 6px 12px; margin-top: 30px; border-left: 4px solid #3b82f6; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .metric-card { border: 1px solid #cbd5e1; padding: 10px; font-size: 12px; }
    .metric-val { font-size: 20px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th { border-bottom: 1px solid #0f172a; padding: 8px; text-align: left; font-weight: bold; }
    td { border-bottom: 1px dashed #cbd5e1; padding: 8px; }
    .footer { border-top: 1px solid #cbd5e1; margin-top: 50px; padding-top: 15px; font-size: 9px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">DNS Sentinel — Incident & Diagnostics Report</div>
    <div class="meta">Generated: ${timestamp} | Context: Cluster-kind | Scraper: Production</div>
  </div>
  <div class="section-title">Telemetry Summary</div>
  <div class="metric-grid">
    <div class="metric-card">Total DNS Volume<div class="metric-val">${metrics.totalQueries.toLocaleString()}</div></div>
    <div class="metric-card">Resolving Failures<div class="metric-val">${metrics.failures.toLocaleString()}</div></div>
    <div class="metric-card">p95 Latency<div class="metric-val">${metrics.latencyPercentiles.p95}ms</div></div>
    <div class="metric-card">System Health<div class="metric-val">${metrics.healthScore}%</div></div>
  </div>
  <div class="section-title">Active Security Bulletins</div>
  <table>
    <thead><tr><th>Severity</th><th>Timestamp</th><th>Incident</th><th>Source</th></tr></thead>
    <tbody>${threats.map(t => `<tr><td><strong>${t.type.toUpperCase()}</strong></td><td>${t.ts}</td><td>${t.title}</td><td>${t.source}</td></tr>`).join('')}</tbody>
  </table>
  <div class="section-title">Remediation Summary</div>
  <p style="font-size:12px;margin-top:15px;">Quarantined nodes: <strong>${quarantinedPods.length}</strong> — Status: <strong>${quarantinedPods.length > 0 ? 'Threat restricted' : 'No active isolations'}</strong></p>
  <div class="footer">DNS Sentinel eBPF Observability Agent · Zero-Instrumentation · API-Free · Kubernetes Native</div>
</body>
</html>`;
}
