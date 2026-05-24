// wsService.js — Singleton WebSocket client
// Manages connection, per-cluster rooms, auto-reconnect, and event dispatch.

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

let _ws            = null;
let _clusterId     = null;
let _token         = null;
let _reconnectTimer = null;
let _reconnectDelay = 1500;
const MAX_DELAY     = 30000;

// ── Event listeners: type → Set<handler> ──────────────────────────────────────
const _listeners   = new Map();
const _statusCbs   = new Set();

// ── Internal pub/sub ──────────────────────────────────────────────────────────
function _emit(type, payload) {
  (_listeners.get(type) || new Set()).forEach(fn => {
    try { fn(payload); } catch {}
  });
}

function _notifyStatus(status) {
  _statusCbs.forEach(fn => { try { fn(status); } catch {} });
}

// ── Public: subscribe to a message type ───────────────────────────────────────
export function on(type, handler) {
  if (!_listeners.has(type)) _listeners.set(type, new Set());
  _listeners.get(type).add(handler);
  return () => _listeners.get(type)?.delete(handler);   // returns unsubscribe fn
}

// ── Public: subscribe to connection status changes ────────────────────────────
export function onStatus(handler) {
  _statusCbs.add(handler);
  return () => _statusCbs.delete(handler);
}

// ── Public: connect / reconnect ───────────────────────────────────────────────
export function connect(token, clusterId) {
  _token     = token;
  _clusterId = clusterId;
  _doConnect();
}

function _doConnect() {
  _clearReconnect();
  if (_ws) {
    _ws.onclose = null;          // prevent reconnect loop on manual close
    _ws.close();
    _ws = null;
  }

  if (!_token || !_clusterId) return;

  const url = `${WS_BASE}/ws?token=${encodeURIComponent(_token)}&cluster=${encodeURIComponent(_clusterId)}`;

  try {
    _ws = new WebSocket(url);
  } catch {
    _notifyStatus('error');
    _scheduleReconnect();
    return;
  }

  _notifyStatus('connecting');

  _ws.onopen = () => {
    _reconnectDelay = 1500;
    _notifyStatus('connected');
  };

  _ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      _emit(msg.type, msg.payload);
    } catch {}
  };

  _ws.onerror = () => {
    _notifyStatus('error');
  };

  _ws.onclose = (evt) => {
    _notifyStatus('disconnected');
    // Don't reconnect on auth errors
    if (evt.code === 4001 || evt.code === 4003 || evt.code === 4004) return;
    _scheduleReconnect();
  };
}

// ── Public: disconnect completely ─────────────────────────────────────────────
export function disconnect() {
  _clearReconnect();
  _token     = null;
  _clusterId = null;
  if (_ws) {
    _ws.onclose = null;
    _ws.close();
    _ws = null;
  }
  _notifyStatus('disconnected');
}

// ── Public: send a message (e.g. ping) ────────────────────────────────────────
export function send(type, payload = {}) {
  if (_ws?.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify({ type, payload }));
  }
}

// ── Public: current connection status ─────────────────────────────────────────
export function getStatus() {
  if (!_ws) return 'disconnected';
  const states = { 0: 'connecting', 1: 'connected', 2: 'closing', 3: 'disconnected' };
  return states[_ws.readyState] || 'disconnected';
}

// ── Reconnect helpers ─────────────────────────────────────────────────────────
function _scheduleReconnect() {
  _reconnectTimer = setTimeout(() => {
    _reconnectDelay = Math.min(_reconnectDelay * 1.5, MAX_DELAY);
    _doConnect();
  }, _reconnectDelay);
}

function _clearReconnect() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
}
