import { useState, useEffect, useCallback, useRef } from 'react';

// Structured static baseline queries for initial populate
const INITIAL_LOGS = [
  { id: 1, ts: '16:11:15', namespace: 'production', pod: 'payment-service-6f8', domain: 'api.stripe.com', type: 'A', latency: 12, rcode: 'NOERROR', status: 'OK' },
  { id: 2, ts: '16:11:12', namespace: 'production', pod: 'payment-service-6f8', domain: 'broken-api.internal.local', type: 'A', latency: 3514, rcode: 'SERVFAIL', status: 'ERROR' },
  { id: 3, ts: '16:11:10', namespace: 'default', pod: 'frontend-app-7f5', domain: 'google.com', type: 'AAAA', latency: 4, rcode: 'NOERROR', status: 'OK' },
  { id: 4, ts: '16:11:08', namespace: 'default', pod: 'frontend-app-7f5', domain: 'slack.com', type: 'A', latency: 18, rcode: 'NOERROR', status: 'OK' },
  { id: 5, ts: '16:11:05', namespace: 'kube-system', pod: 'coredns-5f82', domain: 'kubernetes.default.svc.cluster.local', type: 'A', latency: 1, rcode: 'NOERROR', status: 'OK' },
  { id: 6, ts: '16:11:02', namespace: 'production', pod: 'auth-manager-3b2', domain: 'aws.amazon.com', type: 'A', latency: 15, rcode: 'NOERROR', status: 'OK' },
  { id: 7, ts: '16:10:58', namespace: 'production', pod: 'payment-service-6f8', domain: 'suspicious-payload-data.xyz', type: 'TXT', latency: 503, rcode: 'NXDOMAIN', status: 'ERROR' },
  { id: 8, ts: '16:10:55', namespace: 'monitoring', pod: 'prometheus-k8s-0', domain: 'grafana.com', type: 'A', latency: 22, rcode: 'NOERROR', status: 'OK' },
  { id: 9, ts: '16:10:51', namespace: 'default', pod: 'frontend-app-7f5', domain: 'github.com', type: 'A', latency: 9, rcode: 'NOERROR', status: 'OK' }
];

const INITIAL_INCIDENTS = [
  { id: 'inc-1', ts: '16:09:42', title: 'Latency Threshold Breached', level: 'warning', desc: 'p99 latency reached 3514ms on broken-api.internal.local query targets.', service: 'payment-service-6f8' },
  { id: 'inc-2', ts: '16:08:15', title: 'NXDOMAIN Failure Burst', level: 'critical', desc: 'Error resolve burst (48% failures) captured on suspicious-payload-data.xyz.', service: 'payment-service-6f8' }
];

const INITIAL_THREATS = [
  { id: 'threat-1', type: 'critical', title: 'Potential DNS Tunneling Behavior', desc: 'Anomalous base64 payload labels in query transactions detected on payment pod app-pod-7f.', source: '10.244.0.5', ts: '16:08:02' },
  { id: 'threat-2', type: 'warning', title: 'High DNS Failure Rate Detected', desc: 'NXDOMAIN spike (45% error rate) on external DNS resolver searches.', source: '10.244.0.7', ts: '16:07:45' }
];

const DOMAIN_POOL = [
  'api.stripe.com', 'google.com', 'slack.com', 'aws.amazon.com', 'github.com',
  'broken-api.internal.local', 'suspicious-payload-data.xyz', 'grafana.com', 'openai.com'
];
const NAMESPACE_POOL = ['production', 'default', 'kube-system', 'monitoring'];
const RECORD_TYPES = ['A', 'AAAA', 'TXT', 'MX'];

export function useTelemetry() {
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected', 'connecting', 'disconnected', 'reconnecting'
  const [totalQueries, setTotalQueries] = useState(512408);
  const [failures, setFailures] = useState(8204);
  const [healthScore, setHealthScore] = useState(99.4);
  const [latencyPercentiles, setLatencyPercentiles] = useState({ p50: 8.4, p95: 14.2, p99: 22.8 });
  const [throughput, setThroughput] = useState(2.1);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [threats, setThreats] = useState(INITIAL_THREATS);
  const [latencyHistory, setLatencyHistory] = useState([
    12.4, 14.8, 13.2, 15.6, 22.1, 11.8, 14.2, 13.9, 16.5, 28.4, 14.8, 12.1, 13.6, 14.2, 15.8
  ]);
  const [threatScore, setThreatScore] = useState(12);
  const [floatingAlerts, setFloatingAlerts] = useState([]);

  const triggerFloatingAlert = useCallback((type, title, desc) => {
    const id = Date.now() + Math.random();
    setFloatingAlerts(prev => [...prev, { id, type, title, desc }]);
    setTimeout(() => {
      setFloatingAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 4000);
  }, []);

  // Keep references to prevent async interval closures
  const totalRef = useRef(totalQueries);
  const failuresRef = useRef(failures);
  totalRef.current = totalQueries;
  failuresRef.current = failures;

  // Toggle outline for manual disconnect demo
  const forceDisconnect = useCallback(() => {
    setConnectionStatus('disconnected');
  }, []);

  const manualReconnect = useCallback(() => {
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('connected');
    }, 1500);
  }, []);

  // Stateful polling updater (Strict memory allocation)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const interval = setInterval(() => {
      const now = new Date();
      const ts = now.toTimeString().split(' ')[0];

      // 1. Tick telemetry numbers
      const newQueries = Math.floor(Math.random() * 4) + 1;
      const isErr = Math.random() > 0.88;
      
      setTotalQueries(prev => prev + newQueries);
      if (isErr) {
        setFailures(prev => prev + 1);
      }

      // 2. Modulate health score
      setHealthScore(prev => {
        const delta = (Math.random() - 0.5) * 0.04;
        return parseFloat(Math.min(Math.max(prev + delta, 97.5), 99.9).toFixed(2));
      });

      // 3. Modulate latency values
      const p50Val = parseFloat((6.2 + Math.random() * 3).toFixed(1));
      const p95Val = parseFloat((12 + Math.random() * 4).toFixed(1));
      let p99Val = parseFloat((20 + Math.random() * 6).toFixed(1));

      // Occasional random outlier spikes (Threshold breaches)
      const hasSpike = Math.random() > 0.94;
      if (hasSpike) {
        p99Val = parseFloat((400 + Math.random() * 150).toFixed(1));
      }
      setLatencyPercentiles({ p50: p50Val, p95: p95Val, p99: p99Val });
      setLatencyHistory(prev => [...prev.slice(1), p95Val]);

      // Update active throughput
      setThroughput(parseFloat((1.5 + Math.random() * 1.6).toFixed(1)));

      // 4. Ingress new log record
      const randomDom = DOMAIN_POOL[Math.floor(Math.random() * DOMAIN_POOL.length)];
      const randomNs = NAMESPACE_POOL[Math.floor(Math.random() * NAMESPACE_POOL.length)];
      const randomType = RECORD_TYPES[Math.floor(Math.random() * RECORD_TYPES.length)];
      const isLogErr = randomDom.includes('broken') || randomDom.includes('suspicious');
      
      const newLog = {
        id: Date.now() + Math.random(),
        ts,
        namespace: randomNs,
        pod: randomNs === 'production' ? 'payment-service-6f8' : 'frontend-app-7f5',
        domain: randomDom,
        type: randomType,
        latency: isLogErr ? (randomDom.startsWith('broken') ? 3500 : 503) : Math.floor(Math.random() * 18) + 4,
        rcode: isLogErr ? (randomDom.startsWith('broken') ? 'SERVFAIL' : 'NXDOMAIN') : 'NOERROR',
        status: isLogErr ? 'ERROR' : 'OK'
      };
      setLogs(prev => [newLog, ...prev].slice(0, 100)); // Memory-Bounded

      // 5. If latency spike occurs, generate an incident alert log
      if (hasSpike) {
        const newInc = {
          id: `inc-${Date.now()}`,
          ts,
          title: 'Latency Threshold Breached',
          level: 'warning',
          desc: `eBPF metrics flagged critical p99 outlier spike of ${p99Val}ms resolving ${randomDom}.`,
          service: newLog.pod
        };
        setIncidents(prev => [newInc, ...prev].slice(0, 50)); // Memory-Bounded
        triggerFloatingAlert('warning', newInc.title, newInc.desc);
      }

      // 6. Occasional suspicious threat alerts loop
      if (Math.random() > 0.96) {
        const securityPool = [
          { type: 'critical', title: 'Possible DNS Tunneling Suspected', desc: 'Outbound DNS exfiltration transaction detected via long base64 label labels.', source: '10.244.0.14' },
          { type: 'warning', title: 'Outbound DNS Query Burst', desc: 'Unusual resolver outbound requests count (640 QPS) matches DDoS fingerprint signatures.', source: '10.244.0.5' }
        ];
        const selectedThreat = securityPool[Math.floor(Math.random() * securityPool.length)];
        const newThreat = {
          id: Date.now(),
          type: selectedThreat.type,
          title: selectedThreat.title,
          desc: selectedThreat.desc,
          source: selectedThreat.source,
          ts
        };
        setThreats(prev => [newThreat, ...prev].slice(0, 10)); // Memory-Bounded
        triggerFloatingAlert(selectedThreat.type, selectedThreat.title, selectedThreat.desc);
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
      failureRate: parseFloat(((failures / Math.max(1, totalQueries)) * 100).toFixed(2))
    },
    logs,
    incidents,
    threats,
    latencyHistory,
    setThreats,
    setThreatScore,
    setHealthScore,
    forceDisconnect,
    manualReconnect,
    floatingAlerts,
    setFloatingAlerts,
    triggerFloatingAlert
  };
}
