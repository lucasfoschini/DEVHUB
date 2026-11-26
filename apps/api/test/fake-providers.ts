/** Minimal stand-in for the Render, Vercel and Neon APIs. One server answers all three; the
 *  paths do not overlap. Only GOOD_KEY is accepted. */
import { createServer } from 'node:http'

export const FAKE_PROVIDERS_PORT = 3997
export const GOOD_KEY = 'rnd_fake_good_key'
/** Accepted at connect, then rejected: lets a test reach the needs_reconnect path. */
export const REVOKED_KEY = 'fake_key_revoked_later'
export const revoked = { on: false }

const routes: Record<string, unknown> = {
  '/v1/owners?limit=1': [{ owner: { id: 'tea-1', name: 'Lucas', email: 'owner@example.test' } }],
  '/v1/services?limit=10': [
    {
      service: {
        id: 'srv-1',
        name: 'devhub-api',
        type: 'web_service',
        suspended: 'not_suspended',
        dashboardUrl: 'https://dashboard.render.com/web/srv-1',
        serviceDetails: { url: 'https://devhub-api.onrender.com' },
      },
    },
  ],
  '/v1/services/srv-1/deploys?limit=3': [
    {
      deploy: {
        id: 'dep-1',
        status: 'live',
        commit: { id: 'abcdef1234567', message: 'Ship it\n\nbody' },
        createdAt: '2026-11-25T10:00:00Z',
        finishedAt: '2026-11-25T10:02:00Z',
      },
    },
  ],
  '/v2/user': { user: { id: 'usr-1', username: 'lucas' } },
  '/v6/deployments?limit=20': {
    deployments: [
      {
        uid: 'dpl_1',
        name: 'devhub-web',
        url: 'devhub-web-abc.vercel.app',
        readyState: 'READY',
        target: 'production',
        created: Date.parse('2026-11-25T11:00:00Z'),
        inspectorUrl: 'https://vercel.com/lucas/devhub-web/dpl_1',
        meta: { githubCommitRef: 'main', githubCommitSha: '1234567abcdef' },
      },
    ],
  },
  '/api/v2/users/me': { id: 'neon-user', email: 'owner@example.test' },
  '/api/v2/users/me/organizations': { organizations: [{ id: 'org-1', name: 'Team' }] },
  '/api/v2/projects?limit=10': {
    projects: [
      { id: 'p-1', name: 'devhub', region_id: 'aws-sa-east-1', pg_version: 17, updated_at: 'x' },
    ],
  },
  '/api/v2/projects?limit=10&org_id=org-1': {
    projects: [
      { id: 'p-1', name: 'devhub', region_id: 'aws-sa-east-1', pg_version: 17, updated_at: 'x' },
      { id: 'p-2', name: 'team-db', region_id: 'aws-us-east-2', pg_version: 18, updated_at: 'x' },
    ],
  },
  '/api/v2/projects/p-1/branches': {
    branches: [
      { id: 'br-1', name: 'main', current_state: 'ready', default: true, updated_at: 'x' },
    ],
  },
  '/api/v2/projects/p-2/branches': { branches: [] },
}

export const fakeProviders = createServer((req, res) => {
  const auth = req.headers.authorization
  const ok = auth === `Bearer ${GOOD_KEY}` || (auth === `Bearer ${REVOKED_KEY}` && !revoked.on)
  const body = routes[req.url ?? '']
  res.writeHead(!ok ? 401 : body ? 200 : 404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(ok && body ? body : {}))
})
