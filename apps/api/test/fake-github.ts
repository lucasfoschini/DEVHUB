/** Minimal stand-in for github.com and api.github.com, enough for the OAuth flow. */
import { createServer } from 'node:http'

export const FAKE_GITHUB_PORT = 3998
export const FAKE = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  code: 'good-code',
  token: 'gho_fake_token',
  user: { id: 42, login: 'octo' },
}

const repo = (id: number, name: string, isPrivate: boolean) => ({
  id,
  full_name: `octo/${name}`,
  description: `Fake ${name}`,
  private: isPrivate,
  archived: false,
  default_branch: 'main',
  html_url: `https://github.com/octo/${name}`,
  language: 'TypeScript',
  pushed_at: '2026-11-20T10:00:00Z',
})
export const REPOS = [repo(1001, 'public-app', false), repo(1002, 'private-api', true)]

/** What the fake received, for assertions. */
export const seen = { verifier: '', revoked: [] as string[] }

async function body(req: import('node:http').IncomingMessage) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? (JSON.parse(raw) as Record<string, string>) : {}
}

export const fakeGithub = createServer(async (req, res) => {
  const json = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  if (req.method === 'POST' && req.url === '/login/oauth/access_token') {
    const b = await body(req)
    if (b.client_secret !== FAKE.clientSecret || b.code !== FAKE.code || !b.code_verifier) {
      return json(200, { error: 'bad_verification_code' })
    }
    seen.verifier = b.code_verifier
    return json(200, { access_token: FAKE.token, scope: 'read:user', token_type: 'bearer' })
  }
  if (req.method === 'GET' && req.url === '/user') {
    if (req.headers.authorization !== `Bearer ${FAKE.token}`) return json(401, {})
    return json(200, FAKE.user)
  }
  const authed = req.headers.authorization === `Bearer ${FAKE.token}`
  if (req.method === 'GET' && req.url?.startsWith('/user/repos?')) {
    if (!authed) return json(401, {})
    return json(200, new URL(req.url, 'http://x').searchParams.get('page') === '1' ? REPOS : [])
  }
  if (req.method === 'GET' && req.url?.startsWith('/repos/octo/private-api/actions/runs?')) {
    if (!authed) return json(401, {})
    return json(200, {
      workflow_runs: [
        {
          id: 9001,
          name: 'CI',
          display_title: 'Fix login',
          head_branch: 'main',
          head_sha: 'abcdef1234567',
          event: 'push',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/octo/private-api/actions/runs/9001',
          created_at: '2026-11-25T10:00:00Z',
          updated_at: '2026-11-25T10:03:00Z',
        },
      ],
    })
  }
  if (req.method === 'GET' && req.url?.startsWith('/repos/octo/private-api/deployments?')) {
    if (!authed) return json(401, {})
    return json(200, [
      {
        id: 77,
        environment: 'production',
        ref: 'main',
        sha: 'abcdef1234567',
        created_at: '2026-11-25T10:05:00Z',
      },
    ])
  }
  if (
    req.method === 'GET' &&
    req.url?.startsWith('/repos/octo/private-api/deployments/77/statuses')
  ) {
    return json(200, [{ state: 'success', created_at: '2026-11-25T10:06:00Z' }])
  }
  const byId = /^\/repositories\/(\d+)$/.exec(req.url ?? '')
  if (req.method === 'GET' && byId) {
    if (!authed) return json(401, {})
    const found = REPOS.find((r) => String(r.id) === byId[1])
    return found ? json(200, found) : json(404, { message: 'Not Found' })
  }
  if (req.method === 'DELETE' && req.url === `/applications/${FAKE.clientId}/grant`) {
    const basic = Buffer.from(`${FAKE.clientId}:${FAKE.clientSecret}`).toString('base64')
    if (req.headers.authorization !== `Basic ${basic}`) return json(401, {})
    seen.revoked.push((await body(req)).access_token ?? '')
    res.writeHead(204)
    return res.end()
  }
  json(404, {})
})
