// apiService.js — REST API wrapper for DNS Sentinel backend

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Token storage ────────────────────────────────────────────────────────────
export const tokenStore = {
  get:    ()      => localStorage.getItem('dns-sentinel-token'),
  set:    (tok)   => localStorage.setItem('dns-sentinel-token', tok),
  clear:  ()      => localStorage.removeItem('dns-sentinel-token'),
};

// ─── Base fetch wrapper ───────────────────────────────────────────────────────
async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = tokenStore.get();
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || data.message || res.statusText);
  return data;
}

// ─── API surface ──────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register:  (email, password, orgName) =>
                 request('POST', '/api/auth/register', { email, password, orgName }),
    login:     (email, password) =>
                 request('POST', '/api/auth/login', { email, password }),
    me:        () => request('GET', '/api/auth/me'),
  },

  clusters: {
    list:            ()          => request('GET',    '/api/clusters'),
    create:          (name)      => request('POST',   '/api/clusters',                    { name }),
    get:             (id)        => request('GET',    `/api/clusters/${id}`),
    delete:          (id)        => request('DELETE', `/api/clusters/${id}`),
    regenToken:      (id)        => request('POST',   `/api/clusters/${id}/regenerate-token`),
    events:          (id, n=50)  => request('GET',    `/api/clusters/${id}/events?limit=${n}`),
    metrics:         (id)        => request('GET',    `/api/clusters/${id}/metrics`),
    incidents:       (id)        => request('GET',    `/api/clusters/${id}/incidents`),
  },
};

// ─── Backend availability check ───────────────────────────────────────────────
export async function checkBackend() {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
