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
import './index.css'

/** Modules with a built screen; the rest show the roadmap empty state. */
const screens: Record<string, ReactNode> = { '/projects': <ProjectsPage /> }

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
        handle: { module: modules.find((x) => x.path === '/projects') } satisfies RouteHandle,
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
