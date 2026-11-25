import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router'
import { modules } from './nav'
import { AppShell, type RouteHandle } from './shell/AppShell'
import { ModulePage, NotFound } from './shell/ModulePage'
import { TokenSpecimen } from './dev/TokenSpecimen'
import './index.css'

const moduleRoutes: RouteObject[] = modules.map((m) => {
  const handle: RouteHandle = { module: m }
  const element = <ModulePage module={m} />
  return m.path === '/'
    ? { index: true, element, handle }
    : { path: m.path.slice(1), element, handle }
})

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [...moduleRoutes, { path: '*', element: <NotFound /> }],
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
