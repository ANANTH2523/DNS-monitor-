// routes/auth.js — Register, Login, Me

const router  = require('express').Router();
const store   = require('../store/store');
const { signToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, orgName } = req.body;
    if (!email || !password || !orgName) {
      return res.status(400).json({ error: 'email, password, and orgName are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create org first (placeholder ownerId), then user, then link
    const tempOrg = store.createOrg(orgName, 'pending');
    const user    = await store.createUser(email, password, tempOrg.id);
    // Patch org owner
    tempOrg.ownerId = user.id;

    // Auto-create a starter cluster for this org
    const cluster = store.createCluster(`${orgName}-cluster-1`, tempOrg.id);

    const token = signToken({ userId: user.id, orgId: tempOrg.id });

    res.status(201).json({
      token,
      user:    { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
      org:     { id: tempOrg.id, name: tempOrg.name, plan: tempOrg.plan },
      cluster: sanitizeCluster(cluster),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user  = await store.verifyUser(email, password);
    const org   = store.getOrg(user.orgId);
    const token = signToken({ userId: user.id, orgId: user.orgId });

    res.json({
      token,
      user:     { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
      org:      org ? { id: org.id, name: org.name, plan: org.plan } : null,
      clusters: store.listClusters(user.orgId).map(sanitizeCluster),
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me — verify token + return user + org + clusters
router.get('/me', requireAuth, (req, res) => {
  const { user } = req;
  const org      = store.getOrg(user.orgId);
  res.json({
    user:     { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
    org:      org ? { id: org.id, name: org.name, plan: org.plan } : null,
    clusters: store.listClusters(user.orgId).map(sanitizeCluster),
  });
});

function sanitizeCluster(c) {
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
