import { useState, useEffect, useCallback } from 'react';

// ─── INITIAL STATIC BASELINE DATA ─────────────────────────────────────────────

const INITIAL_LOGS = [
  { id: 1,  ts: '16:11:15', namespace: 'production',  pod: 'payment-service-6f8', domain: 'api.stripe.com',                      type: 'A',    latency: 12,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 2,  ts: '16:11:12', namespace: 'production',  pod: 'payment-service-6f8', domain: 'broken-api.internal.local',           type: 'A',    latency: 3514, rcode: 'SERVFAIL', status: 'ERROR' },
  { id: 3,  ts: '16:11:10', namespace: 'default',     pod: 'frontend-app-7f5',    domain: 'google.com',                          type: 'AAAA', latency: 4,    rcode: 'NOERROR',  status: 'OK'    },
  { id: 4,  ts: '16:11:08', namespace: 'default',     pod: 'frontend-app-7f5',    domain: 'slack.com',                           type: 'A',    latency: 18,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 5,  ts: '16:11:05', namespace: 'kube-system', pod: 'coredns-5f82',        domain: 'kubernetes.default.svc.cluster.local',type: 'A',    latency: 1,    rcode: 'NOERROR',  status: 'OK'    },
  { id: 6,  ts: '16:11:02', namespace: 'production',  pod: 'auth-manager-3b2',    domain: 'aws.amazon.com',                      type: 'A',    latency: 15,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 7,  ts: '16:10:58', namespace: 'production',  pod: 'payment-service-6f8', domain: 'suspicious-payload-data.xyz',         type: 'TXT',  latency: 503,  rcode: 'NXDOMAIN', status: 'ERROR' },
  { id: 8,  ts: '16:10:55', namespace: 'monitoring',  pod: 'prometheus-k8s-0',    domain: 'grafana.com',                         type: 'A',    latency: 22,   rcode: 'NOERROR',  status: 'OK'    },
  { id: 9,  ts: '16:10:51', namespace: 'default',     pod: 'frontend-app-7f5',    domain: 'github.com',                          type: 'A',    latency: 9,    rcode: 'NOERROR',  status: 'OK'    },
];

const INITIAL_INCIDENTS = [
  { id: 'inc-1', ts: '16:09:42', title: 'Latency Threshold Breached',  level: 'warning',  desc: 'p99 latency reached 3514ms on broken-api.internal.local query targets.',              service: 'payment-service-6f8' },
  { id: 'inc-2', ts: '16:08:15', title: 'NXDOMAIN Failure Burst',      level: 'critical', desc: 'Error resolve burst (48% failures) captured on suspicious-payload-data.xyz.',         service: 'payment-service-6f8' },
  { id: 'inc-3', ts: '16:06:10', title: 'CoreDNS Upstream Timeout',    level: 'warning',  desc: 'CoreDNS upstream 8.8.8.8 responded with latency >2000ms during resolution.',          service: 'coredns-5f82'        },
];

const INITIAL_THREATS = [
  { id: 'threat-1', type: 'critical', title: 'Potential DNS Tunneling Behavior',    desc: 'Anomalous base64 payload labels in query transactions detected on payment pod.', source: '10.244.0.5',  ts: '16:08:02' },
  { id: 'threat-2', type: 'warning',  title: 'High DNS Failure Rate Detected',      desc: 'NXDOMAIN spike (45% error rate) on external DNS resolver searches.',            source: '10.244.0.7',  ts: '16:07:45' },
];

const INITIAL_PODS = [
  { id: 'pod-1', name: 'payment-service-6f8b4d', namespace: 'production',  status: 'Running',           restarts: 0,  age: '14d', dnsQueries: 1842, cpu: '42%', mem: '318Mi' },
  { id: 'pod-2', name: 'frontend-app-7f5c9a',   namespace: 'default',      status: 'Running',           restarts: 0,  age: '14d', dnsQueries: 924,  cpu: '18%', mem: '128Mi' },
  { id: 'pod-3', name: 'auth-manager-3b2e1f',   namespace: 'production',   status: 'Running',           restarts: 1,  age: '7d',  dnsQueries: 556,  cpu: '31%', mem: '256Mi' },
  { id: 'pod-4', name: 'coredns-5f82bc',        namespace: 'kube-system',  status: 'Running',           restarts: 0,  age: '21d', dnsQueries: 412,  cpu: '8%',  mem: '54Mi'  },
  { id: 'pod-5', name: 'prometheus-k8s-0',      namespace: 'monitoring',   status: 'Running',           restarts: 0,  age: '14d', dnsQueries: 287,  cpu: '12%', mem: '512Mi' },
  { id: 'pod-6', name: 'api-gateway-8c3a2b',    namespace: 'production',   status: 'Warning',           restarts: 3,  age: '2d',  dnsQueries: 743,  cpu: '78%', mem: '612Mi' },
  { id: 'pod-7', name: 'cache-redis-2b1f4c',    namespace: 'default',      status: 'Running',           restarts: 0,  age: '14d', dnsQueries: 198,  cpu: '5%',  mem: '96Mi'  },
  { id: 'pod-8', name: 'worker-batch-9d4e7a',   namespace: 'production',   status: 'CrashLoopBackOff',  restarts: 12, age: '1d',  dnsQueries: 0,    cpu: '0%',  mem: '0Mi'   },
];

const DOMAIN_POOL = [
  'api.stripe.com', 'google.com', 'slack.com', 'aws.amazon.com', 'github.com',
  'broken-api.internal.local', 'suspicious-payload-data.xyz', 'grafana.com', 'openai.com',
];
const NAMESPACE_POOL = ['production', 'default', 'kube-system', 'monitoring'];
const RECORD_TYPES   = ['A', 'AAAA', 'TXT', 'MX'];

// Build a realistic 7-day × 24-hour query volume heatmap
function generateHeatmapData() {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const isWeekday      = d >= 1 && d <= 5;
      const isBusinessHour = h >= 8  && h <= 19;
      if (isWeekday && isBusinessHour) return Math.floor(Math.random() * 380 + 70);
      if (isWeekday)                   return Math.floor(Math.random() * 80  + 10);
      return Math.floor(Math.random() * 50 + 5);
    })
  );
}

// ─── MAIN HOOK ───────────────────────────────────────────────────────────────

export function useTelemetry() {
  // Core metrics
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [totalQueries,     setTotalQueries]     = useState(512408);
  const [failures,         setFailures]         = useState(8204);
  const [healthScore,      setHealthScore]       = useState(99.4);
  const [latencyPercentiles, setLatencyPercentiles] = useState({ p50: 8.4, p95: 14.2, p99: 22.8 });
  const [throughput,       setThroughput]       = useState(2.1);
  const [cacheHitRate,     setCacheHitRate]     = useState(84.2);
  const [threatScore,      setThreatScore]      = useState(12);

  // Data streams
  const [logs,       setLogs]       = useState(INITIAL_LOGS);
  const [incidents,  setIncidents]  = useState(INITIAL_INCIDENTS);
  const [threats,    setThreats]    = useState(INITIAL_THREATS);
  const [pods,       setPods]       = useState(INITIAL_PODS);

  // Chart histories
  const [latencyHistory,   setLatencyHistory]   = useState([12.4, 14.8, 13.2, 15.6, 22.1, 11.8, 14.2, 13.9, 16.5, 28.4, 14.8, 12.1, 13.6, 14.2, 15.8]);
  const [qpsHistory,       setQpsHistory]       = useState(() => Array.from({ length: 30 }, () => parseFloat((1.2 + Math.random() * 1.8).toFixed(1))));

  // Static datasets (generated once)
  const [recordTypeStats, setRecordTypeStats] = useState({ A: 58, AAAA: 22, TXT: 12, MX: 8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [heatmapData] = useState(() => generateHeatmapData());

  // Toast alerts
  const [floatingAlerts, setFloatingAlerts] = useState([]);

  // ── Floating alert dispatcher ──────────────────────────────────────────────
  const triggerFloatingAlert = useCallback((type, title, desc) => {
    const id = Date.now() + Math.random();
    setFloatingAlerts(prev => [...prev, { id, type, title, desc }]);
    setTimeout(() => setFloatingAlerts(prev => prev.filter(a => a.id !== id)), 4500);
  }, []);

  // ── Connection simulation ─────────────────────────────────────────────────
  const forceDisconnect = useCallback(() => setConnectionStatus('disconnected'), []);
  const manualReconnect = useCallback(() => {
    setConnectionStatus('connecting');
    setTimeout(() => setConnectionStatus('connected'), 1500);
  }, []);

  // ── Live polling interval ─────────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const interval = setInterval(() => {
      const ts = new Date().toTimeString().split(' ')[0];

      // 1. Tick totals
      const newQ  = Math.floor(Math.random() * 4) + 1;
      const isErr = Math.random() > 0.88;
      setTotalQueries(prev => prev + newQ);
      if (isErr) setFailures(prev => prev + 1);

      // 2. Health & cache
      setHealthScore(prev => parseFloat(Math.min(Math.max(prev + (Math.random() - 0.5) * 0.04, 97.5), 99.9).toFixed(2)));
      setCacheHitRate(prev => parseFloat(Math.min(99, Math.max(70, prev + (Math.random() - 0.5) * 0.5)).toFixed(1)));

      // 3. Latency
      const p50Val  = parseFloat((6.2  + Math.random() * 3).toFixed(1));
      const p95Val  = parseFloat((12   + Math.random() * 4).toFixed(1));
      let   p99Val  = parseFloat((20   + Math.random() * 6).toFixed(1));
      const hasSpike = Math.random() > 0.94;
      if (hasSpike) p99Val = parseFloat((400 + Math.random() * 150).toFixed(1));
      setLatencyPercentiles({ p50: p50Val, p95: p95Val, p99: p99Val });
      setLatencyHistory(prev => [...prev.slice(1), p95Val]);

      // 4. Throughput + QPS sparkline
      const tpVal = parseFloat((1.5 + Math.random() * 1.6).toFixed(1));
      setThroughput(tpVal);
      setQpsHistory(prev => [...prev.slice(1), tpVal]);

      // 5. Record type distribution (slight drift)
      if (Math.random() > 0.7) {
        setRecordTypeStats(prev => ({
          A:    Math.max(40, Math.min(75, prev.A    + Math.floor((Math.random() - 0.5) * 3))),
          AAAA: Math.max(10, Math.min(35, prev.AAAA + Math.floor((Math.random() - 0.5) * 2))),
          TXT:  Math.max(5,  Math.min(20, prev.TXT  + Math.floor((Math.random() - 0.5) * 2))),
          MX:   Math.max(2,  Math.min(15, prev.MX   + Math.floor((Math.random() - 0.5) * 1))),
        }));
      }

      // 6. New DNS log entry
      const randomDom  = DOMAIN_POOL[Math.floor(Math.random() * DOMAIN_POOL.length)];
      const randomNs   = NAMESPACE_POOL[Math.floor(Math.random() * NAMESPACE_POOL.length)];
      const randomType = RECORD_TYPES[Math.floor(Math.random() * RECORD_TYPES.length)];
      const isLogErr   = randomDom.includes('broken') || randomDom.includes('suspicious');
      const newLog = {
        id:        Date.now() + Math.random(),
        ts,
        namespace: randomNs,
        pod:       randomNs === 'production' ? 'payment-service-6f8' : 'frontend-app-7f5',
        domain:    randomDom,
        type:      randomType,
        latency:   isLogErr ? (randomDom.startsWith('broken') ? 3500 : 503) : Math.floor(Math.random() * 18) + 4,
        rcode:     isLogErr ? (randomDom.startsWith('broken') ? 'SERVFAIL' : 'NXDOMAIN') : 'NOERROR',
        status:    isLogErr ? 'ERROR' : 'OK',
      };
      setLogs(prev => [newLog, ...prev].slice(0, 100));

      // 7. Latency spike → incident
      if (hasSpike) {
        const inc = {
          id:      `inc-${Date.now()}`,
          ts,
          title:   'Latency Threshold Breached',
          level:   'warning',
          desc:    `eBPF flagged p99 outlier spike of ${p99Val}ms resolving ${randomDom}.`,
          service: newLog.pod,
        };
        setIncidents(prev => [inc, ...prev].slice(0, 50));
        triggerFloatingAlert('warning', inc.title, inc.desc);
      }

      // 8. Occasional security threat
      if (Math.random() > 0.96) {
        const pool = [
          { type: 'critical', title: 'Possible DNS Tunneling Suspected',  desc: 'Outbound DNS exfiltration detected via long base64 label labels.',           source: '10.244.0.14' },
          { type: 'warning',  title: 'Outbound DNS Query Burst Detected', desc: 'Unusual resolver outbound count (640 QPS) matches DDoS fingerprint.',         source: '10.244.0.5'  },
        ];
        const st       = pool[Math.floor(Math.random() * pool.length)];
        const newThreat = { id: Date.now(), ...st, ts };
        setThreats(prev => [newThreat, ...prev].slice(0, 10));
        triggerFloatingAlert(st.type, st.title, st.desc);
      }

      // 9. Pod DNS query counters
      if (Math.random() > 0.5) {
        setPods(prev =>
          prev.map(p => ({
            ...p,
            dnsQueries: p.status !== 'CrashLoopBackOff'
              ? p.dnsQueries + Math.floor(Math.random() * 4)
              : p.dnsQueries,
          }))
        );
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [connectionStatus, triggerFloatingAlert]);

  return {
    connectionStatus,
    metrics: {
      totalQueries,
      failures,
      healthScore,
      latencyPercentiles,
      throughput,
      threatScore,
      cacheHitRate,
      failureRate: parseFloat(((failures / Math.max(1, totalQueries)) * 100).toFixed(2)),
    },
    logs,
    incidents,
    threats,
    pods,
    latencyHistory,
    qpsHistory,
    recordTypeStats,
    heatmapData,
    setThreats,
    setThreatScore,
    setHealthScore,
    forceDisconnect,
    manualReconnect,
    floatingAlerts,
    setFloatingAlerts,
    triggerFloatingAlert,
  };
}
