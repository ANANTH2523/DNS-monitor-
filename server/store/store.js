// store.js — In-memory multi-tenant data store
// Each entity is isolated by orgId / clusterId.
// Designed to be swapped for PostgreSQL/TimescaleDB in production.

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── Raw Maps ────────────────────────────────────────────────────────────────
const users         = new Map(); // userId   → user
const orgs          = new Map(); // orgId    → org
const clusters      = new Map(); // clusterId → cluster
const agentTokens   = new Map(); // token    → clusterId
const eventBuffers  = new Map(); // clusterId → Event[]   (ring, max 200)
const incidentLists = new Map(); // clusterId → Incident[]
const metricsState  = new Map(); // clusterId → MetricState

// ─── Cluster profiles — what makes each cluster unique ───────────────────────
const PROFILES = [
  {
    label:       'production',
    failureRate:  0.05,
    latencyBase:  6,
    queryRate:    4,                              // events/second
    namespace:   'production',
    pods:        ['payment-svc-6f8', 'api-gateway-3b2', 'auth-mgr-7c4', 'frontend-9d1'],
    domainPool:  ['api.stripe.com', 'api.sendgrid.com', 'api.twilio.com', 'aws.amazon.com',
                  'api.github.com', 'api.slack.com', 'grafana.com', 'prometheus.io'],
    failDomains: ['broken-db.internal.local', 'legacy-api.internal'],
    alertRate:   0.012,
  },
  {
    label:       'staging',
    failureRate:  0.18,
    latencyBase:  20,
    queryRate:    2,
    namespace:   'staging',
    pods:        ['staging-app-1a2', 'test-worker-5b3', 'mock-service-2c4'],
    domainPool:  ['staging-api.internal', 'api.stripe.com', 'redis.staging.local',
                  'postgres.staging.local', 'api.github.com'],
    failDomains: ['broken-service.staging', 'missing-dep.staging.local'],
    alertRate:   0.045,
  },
  {
    label:       'development',
    failureRate:  0.30,
    latencyBase:  28,
    queryRate:    1,
    namespace:   'development',
    pods:        ['dev-app-8e1', 'local-worker-3f2'],
    domainPool:  ['dev-api.local', 'localhost', 'api.stripe.com', 'dev-db.local'],
    failDomains: ['broken-thing.dev', 'nonexistent.local', 'bad-config.dev'],
    alertRate:   0.080,
  },
];

const RECORD_TYPES = ['A', 'AAAA', 'TXT', 'MX'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return Math.round(sorted[idx]);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function initMetrics() {
  return {
    totalQueries:    0,
    failures:        0,
    throughput:      0,
    p50: 0, p95: 0, p99: 0,
    healthScore:     99.5,
    cacheHitRate:    82.0,
    threatScore:     5,
    latencyWindow:   [],    // last 100 latency readings
    qpsWindow:       [],    // last 30 QPS readings
    rcodes:          { NOERROR: 0, NXDOMAIN: 0, SERVFAIL: 0, REFUSED: 0 },
  };
}

// ─── USER ─────────────────────────────────────────────────────────────────────
async function createUser(email, password, orgId, role = 'admin') {
  const existingByEmail = [...users.values()].find(u => u.email === email);
  if (existingByEmail) throw new Error('Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id:           uuidv4(),
    email:        email.toLowerCase().trim(),
    passwordHash,
    orgId,
    role,
    createdAt:    new Date().toISOString(),
  };
  users.set(user.id, user);
  return user;
}

async function verifyUser(email, password) {
  const user = [...users.values()].find(u => u.email === email.toLowerCase().trim());
  if (!user) throw new Error('Invalid email or password');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid email or password');
  return user;
}

function getUserById(id) { return users.get(id) || null; }

// ─── ORGANIZATION ─────────────────────────────────────────────────────────────
function createOrg(name, ownerId) {
  const org = {
    id:        uuidv4(),
    name:      name.trim(),
    plan:      'free',
    ownerId,
    createdAt: new Date().toISOString(),
  };
  orgs.set(org.id, org);
  return org;
}

function getOrg(id) { return orgs.get(id) || null; }

// ─── CLUSTER ──────────────────────────────────────────────────────────────────
function createCluster(name, orgId) {
  // Assign profile based on how many clusters this org already has
  const existing = [...clusters.values()].filter(c => c.orgId === orgId);
  const profileIdx = existing.length % PROFILES.length;
  const profile    = PROFILES[profileIdx];

  const agentToken = 'dsntl_' + uuidv4().replace(/-/g, '');

  const cluster = {
    id:           uuidv4(),
    name:         name.trim(),
    orgId,
    profile,
    agentToken,
    status:       'simulated',   // 'simulated' | 'online' | 'offline'
    agentVersion: null,
    lastSeen:     null,
    createdAt:    new Date().toISOString(),
  };

  clusters.set(cluster.id, cluster);
  agentTokens.set(agentToken, cluster.id);
  eventBuffers.set(cluster.id, []);
  incidentLists.set(cluster.id, []);
  metricsState.set(cluster.id, initMetrics());

  return cluster;
}

function getCluster(id)         { return clusters.get(id) || null; }
function getClusterByToken(tok) { const id = agentTokens.get(tok); return id ? clusters.get(id) : null; }

function listClusters(orgId) {
  return [...clusters.values()].filter(c => c.orgId === orgId);
}

function deleteCluster(id) {
  const c = clusters.get(id);
  if (!c) return false;
  agentTokens.delete(c.agentToken);
  clusters.delete(id);
  eventBuffers.delete(id);
  incidentLists.delete(id);
  metricsState.delete(id);
  return true;
}

function regenerateToken(clusterId) {
  const c = clusters.get(clusterId);
  if (!c) return null;
  agentTokens.delete(c.agentToken);
  const newToken = 'dsntl_' + uuidv4().replace(/-/g, '');
  c.agentToken   = newToken;
  agentTokens.set(newToken, clusterId);
  return newToken;
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function generateDNSEvent(cluster) {
  const p       = cluster.profile;
  const isError = Math.random() < p.failureRate;
  const domain  = isError && Math.random() > 0.4
    ? pick(p.failDomains)
    : pick(p.domainPool);

  const hasSpike   = Math.random() > 0.96;
  const base       = p.latencyBase + (Math.random() - 0.5) * p.latencyBase * 0.5;
  const latency    = Math.round(hasSpike ? base * 35 + Math.random() * 1500 : base);
  const rcode      = isError
    ? (domain.includes('broken') || domain.includes('bad') ? 'SERVFAIL' : 'NXDOMAIN')
    : 'NOERROR';

  return {
    id:        Date.now() + Math.random(),
    ts:        new Date().toLocaleTimeString('en-GB'),
    namespace: p.namespace,
    pod:       pick(p.pods),
    domain,
    type:      pick(RECORD_TYPES),
    latency,
    rcode,
    status:    isError ? 'ERROR' : 'OK',
    spike:     hasSpike,
  };
}

function addEvent(clusterId, event) {
  if (!eventBuffers.has(clusterId)) eventBuffers.set(clusterId, []);
  const buf = eventBuffers.get(clusterId);
  buf.unshift(event);
  if (buf.length > 200) buf.pop();
}

function getEvents(clusterId, limit = 50) {
  return (eventBuffers.get(clusterId) || []).slice(0, limit);
}

// ─── METRICS ──────────────────────────────────────────────────────────────────
function updateMetrics(clusterId, event) {
  if (!metricsState.has(clusterId)) metricsState.set(clusterId, initMetrics());
  const m = metricsState.get(clusterId);

  m.totalQueries++;
  if (event.status === 'ERROR') m.failures++;
  m.rcodes[event.rcode] = (m.rcodes[event.rcode] || 0) + 1;

  // Rolling latency window (last 100)
  m.latencyWindow.push(event.latency);
  if (m.latencyWindow.length > 100) m.latencyWindow.shift();
  const sorted = [...m.latencyWindow].sort((a, b) => a - b);
  m.p50 = percentile(sorted, 50);
  m.p95 = percentile(sorted, 95);
  m.p99 = percentile(sorted, 99);

  // Health score: degrades with errors, recovers slowly
  const errorRate = m.totalQueries ? m.failures / m.totalQueries : 0;
  m.healthScore   = parseFloat(Math.max(60, 99.9 - errorRate * 300).toFixed(1));
  m.cacheHitRate  = parseFloat(Math.min(99, Math.max(60, 84 - errorRate * 50 + (Math.random() - 0.5) * 2)).toFixed(1));
  m.failureRate   = parseFloat((errorRate * 100).toFixed(2));
  m.throughput    = parseFloat((m.latencyWindow.length > 1 ? (1000 / (m.latencyWindow.reduce((a, b) => a + b, 0) / m.latencyWindow.length)) : 2).toFixed(1));
}

function pushQpsTick(clusterId, qps) {
  const m = metricsState.get(clusterId);
  if (!m) return;
  m.qpsWindow.push(qps);
  if (m.qpsWindow.length > 30) m.qpsWindow.shift();
}

function getMetrics(clusterId) {
  return metricsState.get(clusterId) || initMetrics();
}

// ─── INCIDENTS ────────────────────────────────────────────────────────────────
const INCIDENT_TEMPLATES = [
  { level: 'critical', title: 'DNS Tunneling Detected',          desc: 'Anomalous base64 labels in TXT query transactions. Possible data exfiltration.' },
  { level: 'warning',  title: 'Latency Threshold Breached',      desc: 'p99 latency spike detected above 1500ms on external resolver.' },
  { level: 'warning',  title: 'NXDOMAIN Burst Detected',         desc: 'Failure resolution burst (>40% error rate) captured on cluster.' },
  { level: 'critical', title: 'SERVFAIL Cascade',                desc: 'CoreDNS upstream resolver returning SERVFAIL for multiple domains.' },
  { level: 'info',     title: 'High Query Rate Observed',        desc: 'DNS query throughput is 3x above baseline. Cluster may be under load.' },
];

function generateIncident(clusterId, triggerEvent) {
  const tmpl = pick(INCIDENT_TEMPLATES);
  return {
    id:      `inc-${uuidv4().slice(0, 8)}`,
    ts:      new Date().toLocaleTimeString('en-GB'),
    ...tmpl,
    service: triggerEvent.pod,
    domain:  triggerEvent.domain,
    clusterId,
  };
}

function addIncident(clusterId, incident) {
  if (!incidentLists.has(clusterId)) incidentLists.set(clusterId, []);
  const list = incidentLists.get(clusterId);
  list.unshift(incident);
  if (list.length > 50) list.pop();
}

function getIncidents(clusterId) {
  return incidentLists.get(clusterId) || [];
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  // User
  createUser, verifyUser, getUserById,
  // Org
  createOrg, getOrg,
  // Cluster
  createCluster, getCluster, getClusterByToken, listClusters, deleteCluster, regenerateToken,
  // Events
  generateDNSEvent, addEvent, getEvents,
  // Metrics
  updateMetrics, pushQpsTick, getMetrics,
  // Incidents
  generateIncident, addIncident, getIncidents,
};
