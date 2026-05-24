import { useState, useEffect, useRef } from 'react';
import * as ws from './wsService';

// ─── Static initial data (shown before any real events arrive) ─────────────────
const SEED_LOGS = [
  { id: 1,  ts: '16:11:15', namespace: 'production',  pod: 'payment-svc-6f8', domain: 'api.stripe.com',                 type: 'A',    latency: 12,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 2,  ts: '16:11:12', namespace: 'production',  pod: 'payment-svc-6f8', domain: 'broken-api.internal.local',      type: 'A',    latency: 3514, rcode: 'SERVFAIL', status: 'ERROR' },
  { id: 3,  ts: '16:11:10', namespace: 'default',     pod: 'frontend-9d1',    domain: 'google.com',                     type: 'AAAA', latency: 4,    rcode: 'NOERROR',  status: 'OK'    },
  { id: 4,  ts: '16:11:08', namespace: 'default',     pod: 'frontend-9d1',    domain: 'slack.com',                      type: 'A',    latency: 18,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 5,  ts: '16:11:05', namespace: 'kube-system', pod: 'coredns-5f82',    domain: 'kubernetes.default.svc.cluster', type: 'A',    latency: 1,    rcode: 'NOERROR',  status: 'OK'    },
];

const SEED_INCIDENTS = [
  { id: 'inc-1', ts: '16:09:42', title: 'Latency Threshold Breached', level: 'warning',  desc: 'p99 latency reached 3514ms on broken-api.internal.local.', service: 'payment-svc-6f8' },
  { id: 'inc-2', ts: '16:08:15', title: 'NXDOMAIN Burst Detected',    level: 'critical', desc: 'Error burst (48%) on suspicious-payload-data.xyz.',         service: 'payment-svc-6f8' },
];

const SEED_THREATS = [
  { id: 'th-1', type: 'critical', title: 'Potential DNS Tunneling',    desc: 'Anomalous base64 labels in TXT transactions.', source: '10.244.0.5', ts: '16:08:02' },
  { id: 'th-2', type: 'warning',  title: 'High DNS Failure Rate',      desc: 'NXDOMAIN spike (45% error rate) on external DNS.', source: '10.244.0.7', ts: '16:07:45' },
];

const SEED_PODS = [
  { id:'p1', name:'payment-svc-6f8b4d',  namespace:'production',  status:'Running',          restarts:0,  dnsQueries:1842, cpu:'42%', mem:'318Mi' },
  { id:'p2', name:'frontend-app-7f5c9a', namespace:'default',      status:'Running',          restarts:0,  dnsQueries:924,  cpu:'18%', mem:'128Mi' },
  { id:'p3', name:'auth-mgr-3b2e1f',     namespace:'production',   status:'Running',          restarts:1,  dnsQueries:556,  cpu:'31%', mem:'256Mi' },
  { id:'p4', name:'coredns-5f82bc',      namespace:'kube-system',  status:'Running',          restarts:0,  dnsQueries:412,  cpu:'8%',  mem:'54Mi'  },
  { id:'p5', name:'api-gateway-8c3a2b',  namespace:'production',   status:'Warning',          restarts:3,  dnsQueries:743,  cpu:'78%', mem:'612Mi' },
  { id:'p6', name:'worker-batch-9d4e7a', namespace:'production',   status:'CrashLoopBackOff', restarts:12, dnsQueries:0,    cpu:'0%',  mem:'0Mi'   },
];

function generateHeatmapData() {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const biz = d >= 1 && d <= 5 && h >= 8 && h <= 19;
      if (biz) return Math.floor(Math.random() * 380 + 70);
      return Math.floor(Math.random() * 50 + 5);
    })
  );
}

// ─── DEMO-MODE simulation (no backend) ─────────────────────────────────────────
const DEMO_DOMAINS = ['api.stripe.com','google.com','slack.com','aws.amazon.com','github.com',
                      'broken-api.internal.local','grafana.com','openai.com'];
const DEMO_NS      = ['production','default','kube-system','monitoring'];
const DEMO_PODS    = ['payment-svc-6f8','frontend-9d1','auth-mgr-3b2','coredns-5f82'];
const TYPES        = ['A','AAAA','TXT','MX'];

function genDemoEvent(id) {
  const isErr  = Math.random() < 0.12;
  const domain = isErr && Math.random() > 0.5
    ? 'broken-api.internal.local'
    : DEMO_DOMAINS[Math.floor(Math.random() * DEMO_DOMAINS.length)];
  const spike  = Math.random() > 0.95;
  const base   = 4 + Math.random() * 10;
  const latency = Math.round(spike ? base * 30 + Math.random() * 800 : base);
  const rcode  = isErr ? (domain.includes('broken') ? 'SERVFAIL' : 'NXDOMAIN') : 'NOERROR';
  return {
    id, ts: new Date().toLocaleTimeString('en-GB'),
    namespace: DEMO_NS[Math.floor(Math.random() * DEMO_NS.length)],
    pod: DEMO_PODS[Math.floor(Math.random() * DEMO_PODS.length)],
    domain, type: TYPES[Math.floor(Math.random() * TYPES.length)],
    latency, rcode, status: isErr ? 'ERROR' : 'OK', spike,
  };
}

// ─── MAIN HOOK ──────────────────────────────────────────────────────────────────
// clusterId + token: when provided, uses real WebSocket backend.
// Otherwise falls back to demo simulation.

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
        if (payload.events?.length)    setLogs(payload.events);
        if (payload.incidents?.length) setIncidents(payload.incidents);
        if (payload.metrics)           applyMetrics(payload.metrics);
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
    setTotalQueries(512408);
    setFailures(8204);
    setHealthScore(99.4);
    setLatencyPercentiles({ p50: 8.4, p95: 14.2, p99: 22.8 });
    setThroughput(2.1);
    setCacheHitRate(84.2);

    const tick = setInterval(() => {
      const id    = counterRef.current++;
      const event = genDemoEvent(id);
      applyEvent(event);

      if (Math.random() < 0.015) {
        const titles = [
          ['warning',  'Latency Threshold Breached', 'p99 spike above 1500ms detected.'],
          ['critical', 'NXDOMAIN Burst Detected',    'Failure burst on external resolver.'],
          ['info',     'High Query Volume',           'DNS throughput 3× above baseline.'],
        ];
        const [level, title, desc] = titles[Math.floor(Math.random() * titles.length)];
        const inc = { id: `inc-${id}`, ts: new Date().toLocaleTimeString('en-GB'), title, level, desc, service: event.pod };
        setIncidents(prev => [inc, ...prev].slice(0, 50));
        triggerAlert(level, title, desc);
      }

      setTotalQueries(n => n + 1);
      setHealthScore(s => parseFloat(Math.max(94, Math.min(99.9, s + (Math.random() - 0.52) * 0.3)).toFixed(1)));
      setLatencyPercentiles(prev => ({
        p50: parseFloat(Math.max(3,  Math.min(40,  prev.p50 + (Math.random() - 0.5) * 1)).toFixed(1)),
        p95: parseFloat(Math.max(8,  Math.min(80,  prev.p95 + (Math.random() - 0.5) * 2)).toFixed(1)),
        p99: parseFloat(Math.max(15, Math.min(200, prev.p99 + (Math.random() - 0.5) * 3)).toFixed(1)),
      }));
      setCacheHitRate(r => parseFloat(Math.max(70, Math.min(99, r + (Math.random() - 0.5) * 0.5)).toFixed(1)));
    }, 2500);

    return () => clearInterval(tick);
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
    latencyHistory, qpsHistory, rcodeData, heatmapData,
    // Alerts
    floatingAlerts,
    // Setters (for export, quarantine etc.)
    setIncidents, setThreats,
  };
}
