import { useState, useEffect, useRef } from 'react';
import * as ws from './wsService';

// ─── INITIAL STATIC DATA (empty until WS snapshot arrives) ─────────────────
const SEED_LOGS      = [];
const SEED_INCIDENTS = [
  { id: 'inc-1', ts: new Date().toISOString().split('T')[1].slice(0, 8), level: 'critical', title: 'Suspicious Tunneling', desc: 'High volume of TXT records to unknown domain', service: 'auth-manager-3b2' },
  { id: 'inc-2', ts: new Date(Date.now() - 120000).toISOString().split('T')[1].slice(0, 8), level: 'warning', title: 'NXDOMAIN Storm', desc: 'Elevated rate of failed resolutions', service: 'payment-service-6f8' }
];
const SEED_THREATS   = [
  { id: 'inc-1', type: 'critical', title: 'Suspicious Tunneling', desc: 'High volume of TXT records to unknown domain', source: 'auth-manager-3b2', ts: new Date().toISOString().split('T')[1].slice(0, 8) }
];
const SEED_PODS      = [
  { id: 'pod-1', name: 'payment-service-6f8', namespace: 'production', status: 'Running', queries: 1420 },
  { id: 'pod-2', name: 'auth-manager-3b2', namespace: 'production', status: 'Running', queries: 840 },
  { id: 'pod-3', name: 'inventory-worker-9x1', namespace: 'production', status: 'Warning', queries: 120 },
  { id: 'pod-4', name: 'redis-cache-main', namespace: 'infrastructure', status: 'Running', queries: 2500 }
];

function generateHeatmapData() {
  return Array.from({ length: 7 }, () => 
    Array.from({ length: 24 }, () => Math.floor(Math.random() * 50))
  );
}

// ─── MAIN HOOK ──────────────────────────────────────────────────────────────────
// clusterId + token: when provided, uses real WebSocket backend.

export function useTelemetry(clusterId = null, token = null) {
  const isRealMode = !!(clusterId && token);

  // ── Connection state ──────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState(
    isRealMode ? 'connecting' : 'demo'
  );

  // ── Core metrics ──────────────────────────────────────────────────────────
  const [totalQueries,       setTotalQueries]       = useState(0);
  const [failures,           setFailures]           = useState(0);
  const [healthScore,        setHealthScore]        = useState(99.5);
  const [latencyPercentiles, setLatencyPercentiles] = useState({ p50: 8, p95: 14, p99: 22 });
  const [throughput,         setThroughput]         = useState(2.1);
  const [cacheHitRate,       setCacheHitRate]       = useState(84.2);
  const [threatScore,        setThreatScore]        = useState(5);
  const [failureRate,        setFailureRate]        = useState(0);

  // ── Data streams ──────────────────────────────────────────────────────────
  const [logs,       setLogs]       = useState(SEED_LOGS);
  const [incidents,  setIncidents]  = useState(SEED_INCIDENTS);
  const [threats,    setThreats]    = useState(SEED_THREATS);
  const [pods,       setPods]       = useState(SEED_PODS);

  // ── Chart histories ───────────────────────────────────────────────────────
  const [latencyHistory, setLatencyHistory] = useState(
    [12, 14, 13, 15, 22, 11, 14, 13, 16, 28, 14, 12, 13, 14, 15]
  );
  const [qpsHistory, setQpsHistory] = useState(
    () => Array.from({ length: 30 }, () => parseFloat((1.2 + Math.random() * 1.8).toFixed(1)))
  );
  const [rcodeData, setRcodeData] = useState({ NXDOMAIN: 12, SERVFAIL: 4, REFUSED: 1 });
  const [recordTypeStats, setRecordTypeStats] = useState({ A: 1420, AAAA: 310, TXT: 85, MX: 42, CNAME: 120 });
  const [heatmapData]             = useState(generateHeatmapData);
  const [floatingAlerts, setFloatingAlerts] = useState([]);

  const counterRef = useRef(SEED_LOGS.length + 1);

  // ── Floating alert helper ─────────────────────────────────────────────────
  function triggerAlert(level, title, desc) {
    const id = Date.now();
    setFloatingAlerts(prev => [...prev, { id, level, title, desc }].slice(-3));
    setTimeout(() => setFloatingAlerts(prev => prev.filter(a => a.id !== id)), 6000);
  }

  // ── Apply one DNS event to all state ─────────────────────────────────────
  function applyEvent(event) {
    setLogs(prev => [event, ...prev].slice(0, 100));
    setTotalQueries(n => n + 1);
    if (event.status === 'ERROR') {
      setFailures(n => n + 1);
      setRcodeData(prev => ({ ...prev, [event.rcode]: (prev[event.rcode] || 0) + 1 }));
    }
    if (event.spike) {
      setLatencyHistory(h => [...h.slice(-14), event.latency]);
    } else {
      setLatencyHistory(h => [...h.slice(-14), event.latency]);
    }
    setQpsHistory(q => [...q.slice(-29), parseFloat((1 + Math.random()).toFixed(1))]);
  }

  // ── Apply incoming metrics snapshot from server ───────────────────────────
  function applyMetrics(m) {
    if (m.p50)         setLatencyPercentiles({ p50: m.p50, p95: m.p95, p99: m.p99 });
    if (m.healthScore) setHealthScore(m.healthScore);
    if (m.cacheHitRate)setCacheHitRate(m.cacheHitRate);
    if (m.failureRate) setFailureRate(m.failureRate);
    if (m.throughput)  setThroughput(m.throughput);
  }

  // ── REAL MODE: WebSocket subscriptions ───────────────────────────────────
  useEffect(() => {
    if (!isRealMode) return;

    ws.connect(token, clusterId);

    const unsubs = [
      ws.onStatus(status => setConnectionStatus(status)),

      ws.on('snapshot', payload => {
        // Initial data burst from server
        if (payload.events)    setLogs(payload.events);
        if (payload.incidents) setIncidents(payload.incidents);
        setThreats([]); // Clear demo threats
        if (payload.metrics)   applyMetrics(payload.metrics);
        const total = payload.events?.length || 0;
        setTotalQueries(total);
        setFailures(payload.events?.filter(e => e.status === 'ERROR').length || 0);
      }),

      ws.on('dns_query', event => applyEvent(event)),

      ws.on('metrics', m => applyMetrics(m)),

      ws.on('incident', incident => {
        setIncidents(prev => [incident, ...prev].slice(0, 50));
        triggerAlert(incident.level, incident.title, incident.desc);
        if (incident.level === 'critical') {
          setThreats(prev => [{
            id:     incident.id,
            type:   'critical',
            title:  incident.title,
            desc:   incident.desc,
            source: incident.service,
            ts:     incident.ts,
          }, ...prev].slice(0, 20));
        }
      }),
    ];

    return () => {
      unsubs.forEach(fn => fn());
      ws.disconnect();
    };
  }, [clusterId, token]);  // eslint-disable-line

  // ── DEMO MODE: local simulation ───────────────────────────────────────────
  useEffect(() => {
    if (isRealMode) return;

    setConnectionStatus('demo');
    setHealthScore(99.5);
    setThroughput(2.1);
    setCacheHitRate(84.2);

    const int1 = setInterval(() => {
      const isErr = Math.random() < 0.05;
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);
      const domains = ['api.stripe.com', 'google.com', 'internal.auth.svc', 'db.production.local', 'slack.com'];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      
      const evt = {
        id: ++counterRef.current,
        ts,
        domain,
        type: Math.random() > 0.3 ? 'A' : 'AAAA',
        rcode: isErr ? 'SERVFAIL' : 'NOERROR',
        latency: Math.floor(Math.random() * 20) + (isErr ? 150 : 2),
        status: isErr ? 'ERROR' : 'OK',
        namespace: 'production',
        pod: 'payment-service-6f8',
      };
      
      setLogs(prev => [evt, ...prev].slice(0, 100));
      setTotalQueries(n => n + 1);
      
      if (isErr) {
        setFailures(n => n + 1);
        setFailureRate(n => Math.min((n + 0.1).toFixed(1), 5.0));
        setRcodeData(prev => ({ ...prev, [evt.rcode]: (prev[evt.rcode] || 0) + 1 }));
      }

      setLatencyHistory(h => [...h.slice(-14), evt.latency]);
      setQpsHistory(q => [...q.slice(-29), parseFloat((1.5 + Math.random() * 2.5).toFixed(1))]);
    }, 600);

    return () => clearInterval(int1);
  }, [isRealMode]); // eslint-disable-line

  return {
    // Status
    connectionStatus,
    isRealMode,
    // Metrics
    totalQueries, failures, healthScore, latencyPercentiles,
    throughput, cacheHitRate, threatScore, failureRate,
    // Streams
    logs, incidents, threats, pods,
    // Charts
    latencyHistory, qpsHistory, rcodeData, heatmapData, recordTypeStats,
    // Alerts
    floatingAlerts,
    setIncidents, setThreats,
    // Connection Controls
    forceDisconnect: () => ws.disconnect(),
    manualReconnect: () => {
      setConnectionStatus('connecting');
      ws.connect(token, clusterId);
    },
  };
}
