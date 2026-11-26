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
      })

      test('module routes', async ({ page }) => {
        for (const m of modules) {
          await page.goto(m.path)
          await expect(page.locator('main')).toBeVisible()
          await axe(page, m.path)
          await expectGlassBudget(page, material)
        }
        await page.goto('/')
        await shot(page, `${theme}-${material}-overview`)
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
