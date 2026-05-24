// Vercel Node.js serverless function — real DNS probe
// Runs on Vercel's edge, does actual dns.resolve4() calls with timing.
// Returns real latency, IP addresses, and RCODE for each domain.

const dns = require('dns');

const resolve4   = (d) => new Promise((res, rej) => dns.resolve4(d, (e, a) => e ? rej(e) : res(a)));
const resolveTxt = (d) => new Promise((res, rej) => dns.resolveTxt(d, (e, a) => e ? rej(e) : res(a)));

// Pool of real domains we probe on every call
const DOMAIN_POOL = [
  { domain: 'google.com',       type: 'A'   },
  { domain: 'cloudflare.com',   type: 'A'   },
  { domain: 'github.com',       type: 'A'   },
  { domain: 'stripe.com',       type: 'A'   },
  { domain: 'aws.amazon.com',   type: 'A'   },
  { domain: 'kubernetes.io',    type: 'A'   },
  { domain: 'vercel.com',       type: 'A'   },
  { domain: 'npmjs.com',        type: 'A'   },
  { domain: 'grafana.com',      type: 'A'   },
  { domain: 'prometheus.io',    type: 'A'   },
  { domain: 'nonexistent-sentinel-probe-xyz.invalid', type: 'A' }, // always NXDOMAIN
];

module.exports = async function handler(req, res) {
  // CORS — allow the frontend (any origin) to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  // Parse requested domains (or pick 4 random ones from the pool)
  let targets;
  if (req.query.domains) {
    targets = req.query.domains
      .split(',')
      .slice(0, 8)
      .map(d => ({ domain: d.trim().toLowerCase(), type: 'A' }));
  } else {
    // Random 4 from pool (including 1 guaranteed NXDOMAIN for realism)
    const real    = DOMAIN_POOL.filter(d => !d.domain.includes('invalid'));
    const bad     = DOMAIN_POOL.filter(d =>  d.domain.includes('invalid'));
    const shuffled = real.sort(() => Math.random() - 0.5).slice(0, 3);
    targets = [...shuffled, ...bad];
  }

  // Run all DNS lookups in parallel
  const results = await Promise.allSettled(
    targets.map(async ({ domain, type }) => {
      const t0 = Date.now();
      try {
        const addresses = await resolve4(domain);
        const latency   = Date.now() - t0;
        return {
          domain,
          type,
          latency,
          addresses: addresses.slice(0, 2),   // first 2 IPs only
          rcode:     'NOERROR',
          status:    'OK',
        };
      } catch (err) {
        const latency = Date.now() - t0;
        const rcode   = err.code === 'ENOTFOUND'  ? 'NXDOMAIN'
                      : err.code === 'ESERVFAIL'  ? 'SERVFAIL'
                      : err.code === 'ECONNREFUSED'? 'REFUSED'
                      : 'SERVFAIL';
        return {
          domain,
          type,
          latency,
          addresses: [],
          rcode,
          status: 'ERROR',
        };
      }
    })
  );

  const queries = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...targets[i], latency: 0, addresses: [], rcode: 'SERVFAIL', status: 'ERROR' }
  );

  return res.status(200).json({
    queries,
    timestamp:    new Date().toISOString(),
    serverRegion: process.env.VERCEL_REGION || 'local',
    probeId:      Math.random().toString(36).slice(2, 10),
  });
};
