import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { modules } from '../src/nav.ts'

/** P8 audit: axe (WCAG 2.2 AA) on every route and overlay, glass budget, screenshots.
 *  Screenshots land in apps/web/audit-screens (gitignored) for manual review. */

const THEMES = ['dark', 'light'] as const
const MATERIALS = ['balanced', 'clear', 'opaque'] as const
/** Glass surfaces allowed on screen at once: 4 shell chrome (sidebar + 3 toolbar groups),
 *  the Activity Shelf pill and 1 overlay. See docs/design/UX_AUDIT.md. */
const MAX_GLASS = 6
const PROJECT = {
  id: '01900000-0000-7000-8000-000000000001',
  name: 'Projeto de auditoria',
  description: 'Dados fixos do teste',
  status: 'development',
  createdAt: '2026-11-26T00:00:00.000Z',
  updatedAt: '2026-11-26T00:00:00.000Z',
}
const MONITOR = {
  id: '01900000-0000-7000-8000-000000000002',
  name: 'Monitor de auditoria',
  url: 'https://example.com/health',
  intervalSeconds: 300,
  timeoutMs: 5000,
  enabled: true,
  state: 'down',
  lastCheckedAt: '2026-11-26T00:05:00.000Z',
  project: null,
  last24h: { checks: 2, uptime: 0.5, p50: null, p95: null, p99: null },
  recentChecks: [
    {
      id: 'c2',
      checkedAt: '2026-11-26T00:05:00.000Z',
      ok: false,
      statusCode: 503,
      latencyMs: 80,
      error: 'http_status',
    },
    {
      id: 'c1',
      checkedAt: '2026-11-26T00:00:00.000Z',
      ok: true,
      statusCode: 200,
      latencyMs: 75,
      error: null,
    },
  ],
  incidents: [
    { id: 'i1', cause: 'http_status', openedAt: '2026-11-26T00:05:00.000Z', resolvedAt: null },
  ],
}
const REPO = {
  id: '01900000-0000-7000-8000-000000000003',
  fullName: 'auditoria/repositorio',
  description: 'Repositório fixo do teste',
  private: true,
  archived: false,
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/auditoria/repositorio',
  language: 'TypeScript',
  pushedAt: '2026-11-20T10:00:00.000Z',
  lastSyncAt: '2026-11-26T00:00:00.000Z',
  projects: [
    { project: { id: '01900000-0000-7000-8000-000000000001', name: 'Projeto de auditoria' } },
  ],
}
const NOTIFICATIONS = {
  unread: 1,
  items: [
    {
      id: '01900000-0000-7000-8000-000000000004',
      kind: 'monitor.down',
      severity: 'critical',
      title: 'Monitor de auditoria está fora do ar',
      body: 'http_status',
      href: '/observability/01900000-0000-7000-8000-000000000002',
      readAt: null,
      createdAt: '2026-11-26T00:05:00.000Z',
    },
    {
      id: '01900000-0000-7000-8000-000000000005',
      kind: 'monitor.recovered',
      severity: 'success',
      title: 'Monitor de auditoria voltou a responder',
      body: '',
      href: '/observability/01900000-0000-7000-8000-000000000002',
      readAt: '2026-11-26T00:04:00.000Z',
      createdAt: '2026-11-26T00:03:00.000Z',
    },
  ],
}
const OVERVIEW = {
  projects: {
    byStatus: { development: 1 },
    recent: [
      {
        id: '01900000-0000-7000-8000-000000000001',
        name: 'Projeto de auditoria',
        status: 'development',
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
    ],
  },
  monitors: { total: 1, up: 0, down: 1, unknown: 0, paused: 0 },
  openIncidents: [
    {
      id: 'i1',
      cause: 'http_status',
      openedAt: '2026-11-26T00:05:00.000Z',
      monitor: {
        id: '01900000-0000-7000-8000-000000000002',
        name: 'Monitor de auditoria',
        project: null,
      },
    },
  ],
  recentPushes: [
    {
      id: '01900000-0000-7000-8000-000000000003',
      fullName: 'auditoria/repositorio',
      pushedAt: '2026-11-20T10:00:00.000Z',
      lastSyncAt: '2026-11-26T00:00:00.000Z',
    },
  ],
  github: { status: 'needs_reconnect', externalLogin: 'auditoria' },
  unreadNotifications: 1,
}
const ME = {
  user: { id: 'u1', name: 'Auditoria', email: 'audit@devhub.test' },
  workspace: { id: 'w1', name: 'Pessoal', role: 'owner' },
}

async function axe(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary).toEqual([])
}

/** Visible elements with a backdrop filter, and how many sit inside another one. */
function glass(page: Page) {
  return page.evaluate(() => {
    const blurred = [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
      const s = getComputedStyle(el)
      return (
        s.backdropFilter !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0
      )
    })
    const nested = blurred.filter((el) => blurred.some((o) => o !== el && o.contains(el))).length
    const names = blurred.map((el) => el.getAttribute('aria-label') ?? el.className.split(' ')[0])
    return { count: blurred.length, nested, names: names.join(' | ') }
  })
}

async function expectGlassBudget(page: Page, material: string) {
  const g = await glass(page)
  expect(g.count, g.names).toBeLessThanOrEqual(material === 'opaque' ? 0 : MAX_GLASS)
  expect(g.nested, g.names).toBe(0)
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `audit-screens/${name}.png` })
}

for (const theme of THEMES) {
  for (const material of MATERIALS) {
    test.describe(`${theme} / ${material}`, () => {
      // Reduced motion makes overlay animations instant, so axe sees settled states.
      test.use({ reducedMotion: 'reduce', colorScheme: theme })
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(
          ({ t, m }) => {
            localStorage.setItem('dh.theme', t)
            localStorage.setItem('dh.material', m)
          },
          { t: theme, m: material },
        )
        // The audit covers the UI, not the API: a fixed signed-in session.
        await page.route('**/api/me', (route) => route.fulfill({ json: ME }))
        await page.route('**/api/integrations/github', (route) =>
          route.fulfill({ json: { configured: true, integration: null } }),
        )
        await page.route('**/api/projects?*', (route) =>
          route.fulfill({ json: { items: [PROJECT], nextCursor: null } }),
        )
        await page.route(`**/api/projects/${PROJECT.id}`, (route) =>
          route.fulfill({ json: PROJECT }),
        )
        await page.route('**/api/monitors', (route) => route.fulfill({ json: [MONITOR] }))
        await page.route('**/api/me/sessions', (route) =>
          route.fulfill({
            json: [
              {
                id: 's1',
                createdAt: '2026-11-26T00:00:00.000Z',
                updatedAt: '2026-11-26T00:10:00.000Z',
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36',
                current: true,
              },
              {
                id: 's2',
                createdAt: '2026-11-25T00:00:00.000Z',
                updatedAt: '2026-11-25T08:00:00.000Z',
                ipAddress: null,
                userAgent: null,
                current: false,
              },
            ],
          }),
        )
        await page.route('**/api/notifications/preferences', (route) =>
          route.fulfill({
            json: {
              kinds: ['monitor.down', 'monitor.recovered', 'integration.needs_reconnect'],
              muted: ['monitor.recovered'],
            },
          }),
        )
        await page.route('**/api/overview', (route) => route.fulfill({ json: OVERVIEW }))
        await page.route('**/api/notifications', (route) => route.fulfill({ json: NOTIFICATIONS }))
        await page.route('**/api/repositories', (route) => route.fulfill({ json: [REPO] }))
        await page.route(`**/api/projects/${PROJECT.id}/repositories`, (route) =>
          route.fulfill({ json: [REPO] }),
        )
        await page.route(`**/api/monitors/${MONITOR.id}`, (route) =>
          route.fulfill({ json: MONITOR }),
        )
      })

      test('module routes', async ({ page }) => {
        for (const m of modules) {
          await page.goto(m.path)
          await expect(page.locator('main')).toBeVisible()
          await axe(page, m.path)
          await expectGlassBudget(page, material)
        }
        await page.goto('/')
        await expect(page.getByRole('link', { name: 'Monitor de auditoria' })).toBeVisible()
        await axe(page, 'overview-data')
        await shot(page, `${theme}-${material}-overview`)
      })

      test('project detail', async ({ page }) => {
        await page.goto(`/projects/${PROJECT.id}`)
        await expect(page.getByRole('heading', { name: PROJECT.name })).toBeVisible()
        await expect(page.getByText(REPO.fullName)).toBeVisible()
        await axe(page, 'project-detail')
        await shot(page, `${theme}-${material}-project-detail`)
      })

      test('monitor detail', async ({ page }) => {
        await page.goto(`/observability/${MONITOR.id}`)
        await expect(page.getByRole('heading', { name: MONITOR.name })).toBeVisible()
        await axe(page, 'monitor-detail')
        await shot(page, `${theme}-${material}-monitor-detail`)
      })

      test('git center', async ({ page }) => {
        await page.goto('/git')
        await expect(page.getByRole('button', { name: 'Conectar GitHub' })).toBeVisible()
        await axe(page, 'git-connect')
        await page.route('**/api/integrations/github', (route) =>
          route.fulfill({
            json: {
              configured: true,
              integration: {
                externalLogin: 'auditoria',
                scopes: ['read:user', 'repo'],
                status: 'connected',
                createdAt: '2026-11-26T00:00:00.000Z',
              },
            },
          }),
        )
        await page.goto('/git?github=connected')
        await expect(page.getByText('@auditoria')).toBeVisible()
        await expect(page.getByText(REPO.fullName)).toBeVisible()
        await axe(page, 'git-connected')
        await shot(page, `${theme}-${material}-git-connected`)
      })

      test('settings', async ({ page }) => {
        await page.goto('/settings')
        await expect(page.getByText('Esta sessão')).toBeVisible()
        await expect(page.getByRole('switch', { name: 'Monitor recuperado' })).not.toBeChecked()
        await axe(page, 'settings')
        await shot(page, `${theme}-${material}-settings`)
      })
      test('overlays', async ({ page }) => {
        await page.goto('/')
        // The shell mounts after /api/me resolves; its shortcuts are not bound before.
        await expect(page.getByRole('button', { name: 'Central de controle' })).toBeVisible()

        await page.keyboard.press('Control+k')
        await expect(page.getByRole('dialog')).toBeVisible()
        await axe(page, 'spotlight')
        await expectGlassBudget(page, material)
        await shot(page, `${theme}-${material}-spotlight`)
        await page.keyboard.type('Simular deploy')
        await page.keyboard.press('Enter')
        await expect(page.getByRole('dialog')).toBeHidden()

        await page.getByRole('button', { name: 'Central de controle' }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await axe(page, 'control-center')
        await expectGlassBudget(page, material)
        await shot(page, `${theme}-${material}-control-center`)
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: /^Notificações/ }).click()
        await expect(page.getByRole('dialog', { name: 'Notificações' })).toBeVisible()
        await expect(
          page.getByRole('dialog', { name: 'Notificações' }).getByText('Status HTTP de erro'),
        ).toBeVisible()
        await axe(page, 'notifications')
        await expectGlassBudget(page, material)
        await shot(page, `${theme}-${material}-notifications`)
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: /^Atividades:/ }).click()
        await expect(page.getByRole('dialog', { name: 'Atividades' })).toBeVisible()
        await axe(page, 'activity-shelf')
        await expectGlassBudget(page, material)
        await shot(page, `${theme}-${material}-activity-shelf`)
        await page.keyboard.press('Escape')
      })

      test('sign-in screen', async ({ page }) => {
        await page.route('**/api/me', (route) => route.fulfill({ status: 401, json: {} }))
        await page.goto('/')
        await expect(page.getByRole('heading', { name: 'Entrar no DevHub' })).toBeVisible()
        await axe(page, 'sign-in')
        await shot(page, `${theme}-${material}-sign-in`)
        await page.getByRole('button', { name: 'Criar uma conta' }).click()
        await axe(page, 'sign-up')
      })

      test('narrow window sheet', async ({ page }) => {
        await page.setViewportSize({ width: 500, height: 800 })
        await page.goto('/')
        await axe(page, 'narrow')
        await page.getByRole('button', { name: 'Mostrar barra lateral' }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await axe(page, 'sidebar-sheet')
        await expectGlassBudget(page, material)
        await shot(page, `${theme}-${material}-sheet`)
      })
    })
  }
}
