// index.js — DNS Sentinel Backend Server
// Runs Express REST API + WebSocket gateway on the same HTTP server.

require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth');
const clusterRoutes = require('./routes/clusters');
const { setupWebSocketServer } = require('./ws/gateway');

const PORT = process.env.PORT || 3001;

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: true,          // allow any origin in dev; lock to your Vercel domain in prod
  credentials: true,
}));
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'dns-sentinel-server', ts: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/clusters', clusterRoutes);

// Telemetry ingest lives under clusters (POST /api/clusters/ingest)
// Agent uses: Authorization: Agent dsntl_xxxxx

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`\n🛡️  DNS Sentinel Backend`);
  console.log(`   REST API  → http://localhost:${PORT}`);
  console.log(`   WebSocket → ws://localhost:${PORT}/ws?token=JWT&cluster=CLUSTER_ID`);
  console.log(`   Health    → http://localhost:${PORT}/health\n`);
});
