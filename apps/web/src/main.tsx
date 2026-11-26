import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router'
import { modules } from './nav'
import { AppShell, type RouteHandle } from './shell/AppShell'
import { ModulePage, NotFound } from './shell/ModulePage'
import { TokenSpecimen } from './dev/TokenSpecimen'
import { SessionGate } from './SessionGate'
import { ProjectsPage } from './projects/ProjectsPage'
import { ProjectDetail } from './projects/ProjectDetail'
import { MonitorsPage } from './monitors/MonitorsPage'
import { MonitorDetail } from './monitors/MonitorDetail'
import { GitCenterPage } from './git/GitCenterPage'
import { OverviewPage } from './overview/OverviewPage'
import { SettingsPage } from './settings/SettingsPage'
import { AiCenterPage } from './ai/AiCenterPage'
import { AnalyticsPage } from './analytics/AnalyticsPage'
import { AutomationsPage } from './automations/AutomationsPage'
import { DeploymentsPage } from './deployments/DeploymentsPage'
import { InfrastructurePage } from './infrastructure/InfrastructurePage'
import { KnowledgePage } from './knowledge/KnowledgePage'
import { SecretsPage } from './secrets/SecretsPage'
import './index.css'

/** Modules with a built screen; the rest show the roadmap empty state. */
const screens: Record<string, ReactNode> = {
  '/': <OverviewPage />,
  '/projects': <ProjectsPage />,
  '/observability': <MonitorsPage />,
  '/git': <GitCenterPage />,
  '/settings': <SettingsPage />,
  '/deployments': <DeploymentsPage />,
  '/infrastructure': <InfrastructurePage />,
  '/ai': <AiCenterPage />,
  '/knowledge': <KnowledgePage />,
  '/automations': <AutomationsPage />,
  '/secrets': <SecretsPage />,
  '/analytics': <AnalyticsPage />,
}
const moduleAt = (path: string) => modules.find((x) => x.path === path)

const moduleRoutes: RouteObject[] = modules.map((m) => {
  const handle: RouteHandle = { module: m }
  const element = screens[m.path] ?? <ModulePage module={m} />
  return m.path === '/'
    ? { index: true, element, handle }
    : { path: m.path.slice(1), element, handle }
})

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <SessionGate>
        <AppShell />
      </SessionGate>
    ),
    children: [
      ...moduleRoutes,
      {
        path: 'projects/:id',
        element: <ProjectDetail />,
        handle: { module: moduleAt('/projects') } satisfies RouteHandle,
      },
      {
        path: 'observability/:id',
        element: <MonitorDetail />,
        handle: { module: moduleAt('/observability') } satisfies RouteHandle,
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/dev/tokens', element: <TokenSpecimen /> },
])

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
