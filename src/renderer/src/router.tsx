import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { createHashHistory } from '@tanstack/history'
import Root from './routes/__root'
import IndexPage from './routes/index'
import DocumentPage from './routes/document.$id'

const hashHistory = createHashHistory()

const rootRoute = createRootRoute({ component: Root })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

const documentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/document/$id',
  component: DocumentPage,
})

const routeTree = rootRoute.addChildren([indexRoute, documentRoute])

export const router = createRouter({
  routeTree,
  history: hashHistory,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
