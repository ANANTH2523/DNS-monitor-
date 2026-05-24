// ws/gateway.js — WebSocket gateway + per-cluster simulation engine
//
// Each cluster has:
//   1. A Set of connected WebSocket clients (room)
//   2. An independent simulation interval (only runs while clients are present)
//
// Protocol:  ws://server/ws?token=JWT_TOKEN&cluster=CLUSTER_ID
// Messages:  { type: 'dns_query' | 'incident' | 'metrics' | 'snapshot', payload: {...} }

const { WebSocketServer, OPEN } = require('ws');
const { verifyToken } = require('../middleware/auth');
const store            = require('../store/store');

// clusterId → Set<WebSocket>
const rooms = new Map();

// clusterId → NodeJS.Timeout
const simIntervals = new Map();

// ─── Send helpers ─────────────────────────────────────────────────────────────
function send(ws, type, payload) {
  if (ws.readyState !== OPEN) return;
  try { ws.send(JSON.stringify({ type, payload })); } catch {}
}

function broadcast(clusterId, type, payload) {
  const room = rooms.get(clusterId);
  if (!room) return;
  const msg = JSON.stringify({ type, payload });
  room.forEach(ws => {
    if (ws.readyState === OPEN) {
      try { ws.send(msg); } catch {}
    }
  });
}

// ─── Simulation engine ────────────────────────────────────────────────────────
function startSimulation(clusterId) {
  if (simIntervals.has(clusterId)) return;          // already running

  const cluster = store.getCluster(clusterId);
  if (!cluster) return;

  const profile       = cluster.profile;
  const intervalMs    = Math.floor(1000 / profile.queryRate);   // e.g. 250ms for 4 QPS
  let   tickCount     = 0;

  const interval = setInterval(() => {
    const room = rooms.get(clusterId);
    if (!room || room.size === 0) {
      // No subscribers — pause simulation to save CPU
      stopSimulation(clusterId);
      return;
    }

    tickCount++;

    // ── Generate DNS event ──────────────────────────────────────────────────
    const event = store.generateDNSEvent(cluster);
    store.addEvent(clusterId, event);
    store.updateMetrics(clusterId, event);
    broadcast(clusterId, 'dns_query', event);

    // ── Broadcast metrics every 5 events ───────────────────────────────────
    if (tickCount % 5 === 0) {
      broadcast(clusterId, 'metrics', store.getMetrics(clusterId));
    }

    // ── Occasionally generate an incident ──────────────────────────────────
    if (Math.random() < profile.alertRate) {
      const incident = store.generateIncident(clusterId, event);
      store.addIncident(clusterId, incident);
      broadcast(clusterId, 'incident', incident);
    }

    // ── Broadcast QPS heartbeat every 30 ticks ─────────────────────────────
    if (tickCount % 30 === 0) {
      broadcast(clusterId, 'heartbeat', {
        ts:        new Date().toISOString(),
        clusterId,
        qps:       profile.queryRate + (Math.random() - 0.5) * 0.8,
      });
    }
  }, intervalMs);

  simIntervals.set(clusterId, interval);
}

function stopSimulation(clusterId) {
  const interval = simIntervals.get(clusterId);
  if (interval) {
    clearInterval(interval);
    simIntervals.delete(clusterId);
  }
}

// ─── Client lifecycle ─────────────────────────────────────────────────────────
function addToRoom(clusterId, ws) {
  if (!rooms.has(clusterId)) rooms.set(clusterId, new Set());
  rooms.get(clusterId).add(ws);
  startSimulation(clusterId);    // start (or continue) simulation for this cluster
}

function removeFromRoom(clusterId, ws) {
  const room = rooms.get(clusterId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) {
    rooms.delete(clusterId);
    // Simulation will self-stop on next tick
  }
}

// ─── WebSocket server setup ───────────────────────────────────────────────────
function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // ── Parse query params ──────────────────────────────────────────────────
    const url       = new URL(req.url, 'http://localhost');
    const token     = url.searchParams.get('token');
    const clusterId = url.searchParams.get('cluster');

    if (!token || !clusterId) {
      ws.close(4001, 'token and cluster params required');
      return;
    }

    // ── Verify JWT ──────────────────────────────────────────────────────────
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      ws.close(4003, 'Invalid or expired token');
      return;
    }

    // ── Verify cluster ownership ────────────────────────────────────────────
    const cluster = store.getCluster(clusterId);
    if (!cluster || cluster.orgId !== payload.orgId) {
      ws.close(4004, 'Cluster not found or access denied');
      return;
    }

    // ── Add to room ─────────────────────────────────────────────────────────
    addToRoom(clusterId, ws);
    ws._clusterId = clusterId;

    // ── Send initial snapshot ───────────────────────────────────────────────
    send(ws, 'snapshot', {
      cluster:   { id: cluster.id, name: cluster.name, status: cluster.status, profile: cluster.profile.label },
      events:    store.getEvents(clusterId, 50),
      metrics:   store.getMetrics(clusterId),
      incidents: store.getIncidents(clusterId),
    });

    send(ws, 'connected', {
      clusterId,
      clusterName: cluster.name,
      profile:     cluster.profile.label,
      ts:          new Date().toISOString(),
    });

    // ── Handle incoming messages (future: client commands) ──────────────────
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'ping') send(ws, 'pong', { ts: Date.now() });
      } catch {}
    });

    // ── Cleanup on disconnect ───────────────────────────────────────────────
    ws.on('close', () => {
      removeFromRoom(ws._clusterId, ws);
    });

    ws.on('error', () => {
      removeFromRoom(ws._clusterId, ws);
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };
