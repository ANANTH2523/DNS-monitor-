// routes/clusters.js — Cluster CRUD, events, metrics, incidents

const router       = require('express').Router();
const store        = require('../store/store');
const { requireAuth } = require('../middleware/auth');

// Guard: ensure cluster belongs to the requester's org
function ownCluster(req, res) {
  const c = store.getCluster(req.params.id);
  if (!c) { res.status(404).json({ error: 'Cluster not found' }); return null; }
  if (c.orgId !== req.user.orgId) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return c;
}

// GET /api/clusters
router.get('/', requireAuth, (req, res) => {
  const list = store.listClusters(req.user.orgId).map(sanitize);
  res.json({ clusters: list });
});

// POST /api/clusters
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Cluster name is required' });
  const existing = store.listClusters(req.user.orgId);
  if (existing.length >= 10) return res.status(400).json({ error: 'Free plan: max 10 clusters' });
  const cluster = store.createCluster(name, req.user.orgId);
  res.status(201).json({ cluster: sanitize(cluster) });
});

// GET /api/clusters/:id
router.get('/:id', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  res.json({ cluster: sanitize(c), metrics: store.getMetrics(c.id) });
});

// DELETE /api/clusters/:id
router.delete('/:id', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  store.deleteCluster(c.id);
  res.json({ ok: true });
});

// POST /api/clusters/:id/regenerate-token
router.post('/:id/regenerate-token', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  const token = store.regenerateToken(c.id);
  res.json({ agentToken: token });
});

// GET /api/clusters/:id/events?limit=50
router.get('/:id/events', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ events: store.getEvents(c.id, limit) });
});

// GET /api/clusters/:id/metrics
router.get('/:id/metrics', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  res.json({ metrics: store.getMetrics(c.id) });
});

// GET /api/clusters/:id/incidents
router.get('/:id/incidents', requireAuth, (req, res) => {
  const c = ownCluster(req, res); if (!c) return;
  res.json({ incidents: store.getIncidents(c.id) });
});

// POST /api/telemetry/ingest — used by real Go agent
// Header: Authorization: Agent dsntl_xxxxx
router.post('/ingest', (req, res) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Agent ')) return res.status(401).json({ error: 'Agent token required' });
  const token   = header.slice(6).trim();
  const cluster = store.getClusterByToken(token);
  if (!cluster) return res.status(401).json({ error: 'Invalid agent token' });

  const { events: evts = [] } = req.body;
  evts.forEach(evt => {
    store.addEvent(cluster.id, evt);
    store.updateMetrics(cluster.id, evt);
  });

  // Update cluster online status
  cluster.status    = 'online';
  cluster.lastSeen  = new Date().toISOString();
  cluster.agentVersion = req.body.agentVersion || 'unknown';

  // Gateway will pick up new events on next broadcast tick
  res.json({ ok: true, received: evts.length });
});

function sanitize(c) {
  return {
    id:           c.id,
    name:         c.name,
    orgId:        c.orgId,
    status:       c.status,
    profile:      c.profile.label,
    agentToken:   c.agentToken,
    agentVersion: c.agentVersion,
    lastSeen:     c.lastSeen,
    createdAt:    c.createdAt,
  };
}

module.exports = router;
