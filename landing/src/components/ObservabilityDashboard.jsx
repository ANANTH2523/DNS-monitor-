import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Layers, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Terminal, 
  BarChart3, 
  Cpu, 
  RefreshCw, 
  Globe,
  Radio,
  Lock,
  Download,
  AlertOctagon,
  Info,
  Wifi,
  WifiOff
} from 'lucide-react';

import { useTelemetry } from '../services/telemetryService';
import LightweightIntro from './LightweightIntro';
import MetricCard from './MetricCard';
import LatencyPercentiles from './LatencyPercentiles';
import LiveQueryFeed from './LiveQueryFeed';
import IncidentTimeline from './IncidentTimeline';
import ThreatAlerts from './ThreatAlerts';
import ArchitectureMap from './ArchitectureMap';

export default function ObservabilityDashboard() {
  const [showIntro, setShowIntro] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Stateful Telemetry provider Client Hook
  const {
    connectionStatus,
    metrics,
    logs,
    incidents,
    threats,
    latencyHistory,
    setThreats,
    setHealthScore,
    forceDisconnect,
    manualReconnect,
    floatingAlerts,
    setFloatingAlerts,
    triggerFloatingAlert
  } = useTelemetry();

  // --- FLOATING ALERTS AND MITIGATION STATES ---
  const [remediatingThreatId, setRemediatingThreatId] = useState(null);
  const [quarantinedPods, setQuarantinedPods] = useState([]);
  const [decodedPayload, setDecodedPayload] = useState(null);
  const [quarantineTerminal, setQuarantineTerminal] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('5m');

  const topDomains = useMemo(() => {
    const domainMap = {};
    logs.forEach(log => {
      if (!domainMap[log.domain]) {
        domainMap[log.domain] = { name: log.domain, count: 0, successes: 0, latencies: [] };
      }
      domainMap[log.domain].count++;
      if (log.status === 'OK') {
        domainMap[log.domain].successes++;
      }
      domainMap[log.domain].latencies.push(log.latency);
    });

    return Object.values(domainMap)
      .map(dom => {
        const successRate = dom.count > 0 ? Math.round((dom.successes / dom.count) * 100) : 100;
        const avgLatency = dom.latencies.length > 0
          ? `${Math.round(dom.latencies.reduce((a, b) => a + b, 0) / dom.latencies.length)}ms`
          : '0ms';
        return {
          name: dom.name,
          count: dom.count,
          successRate,
          latency: avgLatency,
          error: successRate < 90
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [logs]);

  // --- NATIVE CSV LOGS EXPORT ---
  const handleExportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Namespace', 'PodSource', 'TargetDomain', 'RecordType', 'Latency(ms)', 'RCODE', 'Status'];
    const rows = logs.map(q => [
      q.ts, q.namespace, q.pod, q.domain, q.type, q.latency, q.rcode, q.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dns_sentinel_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [logs]);

  // --- NATIVE JSON INCIDENTS EXPORT ---
  const handleExportJSON = useCallback(() => {
    const jsonContent = JSON.stringify(incidents, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dns_sentinel_incidents_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [incidents]);

  // --- NATIVE INCIDENT PDF/HTML REPORT GENERATION ---
  const handleExportIncidentReport = useCallback(() => {
    const timestamp = new Date().toLocaleString();
    const isolatedCount = quarantinedPods.length;
    
    // Construct HTML template print-ready report
    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DNS Sentinel - Official Incident Report</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; background-color: #ffffff; color: #1e293b; padding: 40px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
    .meta { font-size: 10px; color: #64748b; margin-top: 5px; }
    .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; background: #f1f5f9; padding: 6px 12px; margin-top: 30px; border-left: 4px solid #3b82f6; }
    .metric-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .metric-card { border: 1px solid #cbd5e1; padding: 10px; font-size: 12px; }
    .metric-val { font-size: 18px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th { border-bottom: 1px solid #0f172a; padding: 8px; text-align: left; font-weight: bold; }
    td { border-bottom: 1px dashed #cbd5e1; padding: 8px; }
    .footer { border-top: 1px solid #cbd5e1; margin-top: 50px; padding-top: 15px; font-size: 9px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">DNS Sentinel Incident & Diagnostics Report</div>
    <div class="meta">Generated: ${timestamp} | SDN context: Cluster Mapped | Scraper profile: Production</div>
  </div>

  <div class="section-title">Telemetry Summary metrics</div>
  <div class="metric-grid">
    <div class="metric-card">Total DNS Volume<div class="metric-val">${metrics.totalQueries}</div></div>
    <div class="metric-card">Resolving Failures<div class="metric-val">${metrics.failures}</div></div>
    <div class="metric-card">p95 Resolve latency<div class="metric-val">${metrics.latencyPercentiles.p95}ms</div></div>
    <div class="metric-card">System health index<div class="metric-val">${metrics.healthScore}%</div></div>
  </div>

  <div class="section-title">Active Security bulletins</div>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Timestamp</th>
        <th>Incident alert</th>
        <th>Affected node</th>
      </tr>
    </thead>
    <tbody>
      ${threats.map(t => `
        <tr>
          <td><strong>${t.type.toUpperCase()}</strong></td>
          <td>${t.ts}</td>
          <td>${t.title}</td>
          <td>${t.source}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">SDN Namespace Remediations</div>
  <div style="font-size: 12px; margin-top: 15px;">
    Total quarantined nodes successfully cordoned: <strong>${isolatedCount}</strong> namespaces.
    <br/>
    Remediation status: <strong>${isolatedCount > 0 ? 'Threat successfully restricted' : 'No active isolations registered'}</strong>.
  </div>

  <div class="footer">
    DNS Sentinel eBPF observability agent | Hardened MVP container profile | Kind controller active.
  </div>
</body>
</html>
    `;
    
    const blob = new Blob([htmlReport], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dns_sentinel_incident_report_${new Date().toISOString().split('T')[0]}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerFloatingAlert('info', 'Report Generated', 'Official DNS incident report downloaded successfully.');
  }, [metrics, threats, quarantinedPods]);

  // --- MITIGATION HANDLERS ---
  const handleQuarantinePod = useCallback((threat) => {
    setRemediatingThreatId(threat.id);
    setQuarantineTerminal('root@dns-sentinel:~# isolating network namespace for pod ' + threat.source + '...');

    setTimeout(() => {
      setQuarantineTerminal(prev => prev + '\nExecuting: kubectl label pod ' + (threat.source.endsWith('.5') ? 'payment-service-6f8' : 'auth-manager-3b2') + ' sentinel-quarantine=true --namespace=production');
    }, 600);

    setTimeout(() => {
      setQuarantineTerminal(prev => prev + '\nApplying Kubernetes NetworkPolicy: dns-sentinel-isolate-namespace');
    }, 1200);

    setTimeout(() => {
      setQuarantineTerminal(prev => prev + '\n[ SUCCESS ] Network namespace restricted. SDN egress exfiltration blocked.');
    }, 1800);

    setTimeout(() => {
      setRemediatingThreatId(null);
      setQuarantinedPods(prev => [...prev, threat.id]);
      setHealthScore(prev => Math.min(99.9, prev + 0.4));
      triggerFloatingAlert('info', 'Remediation Succeeded', 'Pod ' + threat.source + ' quarantined. SDN access restricted.');

      // Update active threat log state
      setThreats(prev =>
        prev.map(t => t.id === threat.id ? { ...t, title: 'RESOLVED (QUARANTINED)', desc: 'Pod isolated from network namespace. Sandbox threat successfully neutralized.' } : t)
      );
    }, 2400);
  }, [setHealthScore, setThreats]);

  const handleDecodePayload = useCallback((threat) => {
    setDecodedPayload({
      raw: 'c2VjcmV0LWNvbmZpZy1kYi1wYXNzd29yZD1zdXBlcmFkbWluMTIz',
      decoded: 'secret-config-db-password=superadmin123 (Leak Neutralized)',
      source: threat.source
    });
  }, []);

  // Refresh trigger
  const triggerRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // --- SVG BEZIER PATH GENERATOR FOR LIVE CHART ---
  const svgChartPath = useMemo(() => {
    const width = 640;
    const height = 140;
    const padding = 10;
    const pointsCount = latencyHistory.length;
    const xStep = (width - padding * 2) / (pointsCount - 1);

    const points = latencyHistory.map((val, idx) => {
      const x = padding + idx * xStep;
      const y = height - padding - (val / 50) * (height - padding * 2);
      return { x, y };
    });

    if (points.length === 0) return { line: '', area: '' };

    const line = points.map((p, idx) => {
      if (idx === 0) return `M ${p.x} ${p.y}`;
      const prev = points[idx - 1];
      const cpX1 = prev.x + (p.x - prev.x) / 3;
      const cpY1 = prev.y;
      const cpX2 = prev.x + 2 * (p.x - prev.x) / 3;
      const cpY2 = p.y;
      return `C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }).join(' ');

    const area = `${line} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { line, area };
  }, [latencyHistory]);

  if (showIntro) {
    return <LightweightIntro onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative flex flex-col min-h-screen text-[#e2e8f0] bg-[#080b11] font-sans antialiased overflow-hidden select-none">
      
      {/* SaaS Observability Background overlay */}
      <div className="absolute inset-0 bg-grid-observability opacity-30 pointer-events-none z-0" />
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-glow-observability opacity-20 pointer-events-none z-0" />

      {/* --- SaaS TOP NAVIGATION HEADER --- */}
      <header className="relative z-10 flex items-center justify-between border-b border-[#1e293b] bg-[#0c101b] px-6 py-3.5 shadow-sm">
        
        {/* Brand & eBPF Agent Status Tag */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#1e293b] border border-[#334155] flex items-center justify-center shadow-sm">
              <Shield className="w-4.5 h-4.5 text-blue-500" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white uppercase">DNS Sentinel</span>
              <p className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold">eBPF CORE OBSERVABILITY</p>
            </div>
          </div>

          {/* Connection status tag */}
          {connectionStatus === 'connected' ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-status-pulse" />
              Agent: connected
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/20 text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Agent: disconnected
            </div>
          )}
        </div>

        {/* Cohesive SaaS Tabs Menu Selector */}
        <nav className="flex bg-[#0f1422] border border-[#1e293b] rounded-md p-0.5 font-mono text-[11px] font-bold">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
              activeTab === 'overview' 
                ? 'bg-[#182035] text-blue-400 border border-blue-500/10' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('stream')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
              activeTab === 'stream' 
                ? 'bg-[#182035] text-blue-400 border border-blue-500/10' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Live DNS Feed
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
              activeTab === 'security' 
                ? 'bg-[#182035] text-blue-400 border border-blue-500/10' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Security SIEM
          </button>
        </nav>

        {/* Global Context Controls */}
        <div className="flex items-center gap-3 text-xs font-mono">
          
          {/* Connection outlines controller */}
          {connectionStatus === 'connected' ? (
            <button 
              onClick={forceDisconnect}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-colors"
            >
              <WifiOff className="w-3 h-3" />
              Disconnect
            </button>
          ) : (
            <button 
              onClick={manualReconnect}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/20 border border-rose-500/30 text-[10px] text-rose-400 hover:bg-rose-950/40 transition-colors"
            >
              <Wifi className="w-3 h-3" />
              Reconnect
            </button>
          )}

          {/* Time range selection */}
          <div className="hidden sm:flex items-center bg-[#080b11] border border-[#1e293b] rounded px-2.5 py-1 text-slate-400">
            <Clock className="w-3 h-3 text-slate-500 mr-1.5" />
            <select 
              value={selectedTimeRange} 
              onChange={(e) => { setSelectedTimeRange(e.target.value); triggerRefresh(); }}
              className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer text-[10px]"
            >
              <option value="5m">Last 5m</option>
              <option value="15m">Last 15m</option>
              <option value="1h">Last 1h</option>
              <option value="6h">Last 6h</option>
            </select>
          </div>

          {/* Refresh Action */}
          <button 
            onClick={triggerRefresh}
            className="flex items-center justify-center p-1.5 rounded bg-[#080b11] border border-[#1e293b] text-slate-400 hover:text-blue-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

      </header>

      {/* --- MAIN TELEMETRY WORKSPACE CANVAS --- */}
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-6 overflow-y-auto">
        
        {/* OUTAGE SKELETON LAYER */}
        {connectionStatus !== 'connected' ? (
          <div className="h-full flex flex-col justify-center items-center py-20 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/20 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white font-mono">eBPF Telemetry Outage Detected</h3>
              <p className="text-xs text-slate-500 font-light max-w-sm">
                Lost active BPF socket connection to KIND cluster control-plane. Checking resolution thresholds...
              </p>
            </div>
            <button 
              onClick={manualReconnect}
              className="px-4 py-2 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-xs font-mono font-bold rounded transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* --- TAB 1: TELEMETRY OVERVIEW --- */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* HERO SECTION */}
                <div className="p-5 rounded-lg bg-[#0c101b] border border-[#1e293b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-blue-500 font-bold">Kubernetes Observability Node</span>
                    <h2 className="text-lg font-bold tracking-tight text-white font-sans">BPF DNS Resolving Telemetry</h2>
                    <p className="text-xs text-slate-400 leading-normal max-w-2xl font-light">
                      Intercepting DNS resolve timings on raw sockets at interface `eth0`. Live charts measure p50/p95/p99 resolve timeouts to identify service performance spikes and security indicators.
                    </p>
                  </div>
                  <button 
                    onClick={handleExportIncidentReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e293b] bg-[#080b11] hover:bg-[#1a202c] hover:border-[#334155] text-slate-400 hover:text-white rounded transition-colors text-[9px] font-mono font-bold self-end sm:self-auto"
                  >
                    <Download className="w-3 h-3 text-blue-400" />
                    Download Incident Report
                  </button>
                </div>

                {/* METRICS OVERVIEW GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard 
                    title="Total Volume" 
                    value={metrics.totalQueries.toLocaleString()} 
                    desc="Scraped live from core controller"
                  />
                  <MetricCard 
                    title="Resolving Failures" 
                    value={metrics.failures.toLocaleString()} 
                    isError={metrics.failureRate > 2}
                    desc={`Error Resolve index: ${metrics.failureRate}%`}
                  />
                  <MetricCard 
                    title="Request Throughput" 
                    value={metrics.throughput} 
                    unit="req/s"
                    desc="UDP resolver traffic load"
                  />
                  <MetricCard 
                    title="Cluster Scrape Health" 
                    value={metrics.healthScore} 
                    unit="%"
                    desc="eBPF raw capturing checks operational"
                  />
                </div>

                {/* ADVANCED METRICS CHART & PERCENTILES */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Latency Graph (Section 4) */}
                  <div className="lg:col-span-2 bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">Live Timing analytics</span>
                        <h3 className="text-xs font-bold text-slate-200 mt-0.5">p95 Latency Index timeline</h3>
                      </div>
                      <span className="text-[8px] font-mono text-blue-400 bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase">Real-Time</span>
                    </div>

                    <div className="w-full h-[140px] relative overflow-hidden flex items-end">
                      <svg width="100%" height="140" className="stroke-blue-500 fill-none" style={{ overflow: 'visible' }}>
                        <line x1="0" y1="10" x2="100%" y2="10" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="4 4" />
                        <line x1="0" y1="50" x2="100%" y2="50" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="4 4" />
                        <line x1="0" y1="90" x2="100%" y2="90" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="4 4" />
                        <line x1="0" y1="130" x2="100%" y2="130" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="4 4" />
                        
                        <path d={svgChartPath.area} className="fill-blue-500/5 stroke-none transition-all duration-300" />
                        <path d={svgChartPath.line} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-blue-400 transition-all duration-300" />
                        
                        {latencyHistory.length > 0 && (
                          <circle 
                            cx={10 + (latencyHistory.length - 1) * (620 / (latencyHistory.length - 1))} 
                            cy={140 - 10 - (latencyHistory[latencyHistory.length - 1] / 50) * 120} 
                            r="3" 
                            className="fill-blue-400 stroke-none" 
                          />
                        )}
                      </svg>

                      <div className="absolute left-1 top-2.5 text-[8px] font-mono text-slate-500 space-y-7 pointer-events-none select-none w-6 pr-1.5 text-right">
                        <p>50ms</p>
                        <p>30ms</p>
                        <p>10ms</p>
                        <p>0ms</p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics Latency Percentiles (Section 3) */}
                  <LatencyPercentiles percentiles={metrics.latencyPercentiles} />

                </div>

                {/* FAILURE ANALYTICS & TOP DOMAINS (Section 5) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Failure code breakdown progress */}
                  <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider block mb-4">RCODE Error Breakdown</span>
                      
                      <div className="space-y-4 font-mono text-[10px]">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>NXDOMAIN (No Such Domain)</span>
                            <span className="text-amber-500">62.8%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1a202c] rounded overflow-hidden">
                            <div className="h-full bg-amber-500 rounded" style={{ width: '62.8%' }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>SERVFAIL (Resolver Outage)</span>
                            <span className="text-rose-500">32.4%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1a202c] rounded overflow-hidden">
                            <div className="h-full bg-rose-500 rounded" style={{ width: '32.4%' }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>REFUSED (Firewall Block)</span>
                            <span className="text-slate-500">4.8%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1a202c] rounded overflow-hidden">
                            <div className="h-full bg-slate-500 rounded" style={{ width: '4.8%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#1e293b]/40 pt-3.5 mt-4 text-[9px] text-slate-500 font-mono">
                      💡 NXDOMAIN anomalies signify search path redundancy timings.
                    </div>
                  </div>

                  {/* Top Resolving domain targets table */}
                  <div className="lg:col-span-2 bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm">
                    <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-4 block">Top Resolving Targets</span>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[10px] text-slate-300">
                        <thead>
                          <tr className="border-b border-[#1e293b] text-slate-500 font-bold uppercase tracking-wider text-[9px] pb-2">
                            <th className="pb-3">Domain target</th>
                            <th className="pb-3 text-right">Volume</th>
                            <th className="pb-3 text-right">Resolve rate</th>
                            <th className="pb-3 text-right">Latency (p95)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]/40">
                          {topDomains.map((dom, idx) => (
                            <tr key={idx} className="hover:bg-[#121824]/40 transition-colors">
                              <td className={`py-3 ${dom.error ? 'text-rose-400 font-semibold' : 'text-slate-200 font-medium'}`}>{dom.name}</td>
                              <td className="py-3 text-right">{dom.count.toLocaleString()}</td>
                              <td className="py-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  dom.successRate > 95 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950/40 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {dom.successRate}%
                                </span>
                              </td>
                              <td className="py-3 text-right text-slate-400">{dom.latency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

            {/* --- TAB 2: LIVE DNS QUERY FEED (Section 2) --- */}
            {activeTab === 'stream' && (
              <motion.div
                key="stream"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <LiveQueryFeed logs={logs} onExportCSV={handleExportCSV} />
              </motion.div>
            )}

            {/* --- TAB 3: SECURITY SIEM & topology --- */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                
                {/* SIEM Incident & Alerts grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Threat Alerts SIEM Pane (Section 7) */}
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
                        triggerFloatingAlert('info', 'Alert Dismissed', 'Warning cleared from logs console.');
                      }}
                    />
                  </div>

                  {/* Incident Timeline Log (Section 2) */}
                  <IncidentTimeline incidents={incidents} onExportJSON={handleExportJSON} />

                </div>

                {/* BPF Topology Map (Section 6) */}
                <ArchitectureMap />

              </motion.div>
            )}

          </AnimatePresence>
        )}

      </div>

      {/* --- SaaS FOOTER (Section 8) --- */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1e293b] bg-[#0c101b] px-6 py-4 text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-bold text-slate-400">DNS Sentinel Core v1.0.0</span>
        </div>
        <p className="text-center sm:text-left">
          Kubernetes BPF logs streaming active | Scrape Interval: 5s | Context: kind-kind
        </p>
        <div className="flex items-center gap-1.5 text-slate-500">
          <Lock className="w-3.5 h-3.5" />
          Secure Observability Profile
        </div>
      </footer>

      {/* --- FLOATING ALERTS RENDER PORTAL --- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {floatingAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="p-4 border border-[#1e293b] bg-[#0c101b]/95 backdrop-blur shadow-lg rounded-lg pointer-events-auto flex items-start gap-3 w-80 font-mono text-[10px]"
            >
              <div className="mt-0.5">
                {alert.type === 'critical' ? (
                  <AlertOctagon className="w-4 h-4 text-rose-500 animate-status-pulse" />
                ) : alert.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                ) : (
                  <Info className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div className="flex-1 space-y-1 font-mono text-[9px]">
                <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold uppercase">
                  <span>TELEMETRY NOTIFICATION</span>
                  <span>{alert.ts}</span>
                </div>
                <h4 className="text-xs font-bold text-white font-sans">{alert.title}</h4>
                <p className="text-slate-400 leading-normal font-sans font-light">{alert.desc}</p>
              </div>
              <button 
                onClick={() => setFloatingAlerts(prev => prev.filter(a => a.id !== alert.id))}
                className="text-slate-500 hover:text-white transition-colors self-start font-sans text-xs"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- PAYLOAD DIALOG INSPECTOR MODAL --- */}
      {decodedPayload && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-lg font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 uppercase tracking-widest text-[9px]">eBPF Telemetry Payload Decoder</span>
              </div>
              <button 
                onClick={() => setDecodedPayload(null)}
                className="text-slate-500 hover:text-white transition-colors text-xs font-bold font-sans"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="space-y-4 text-[10px] leading-relaxed">
              <p className="text-slate-400">Raw base64 packet payload captured from network interface:</p>
              <div className="bg-[#080b11] border border-[#1e293b] rounded p-2.5 text-rose-500 break-all select-all font-semibold">
                {decodedPayload.raw}
              </div>
              
              <div className="py-1.5 px-3 rounded bg-blue-950/20 border border-blue-500/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-status-pulse" />
                <p className="text-[9px] text-blue-300 font-bold uppercase tracking-wider">Decoded DNS label stream:</p>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400 font-bold">DECRYPTED TX RECORD STRING:</p>
                <div className="bg-[#080b11] border border-blue-500/25 rounded p-2.5 text-emerald-400 text-xs font-bold break-all shadow-inner">
                  {decodedPayload.decoded}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
