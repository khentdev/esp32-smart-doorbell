import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authRoutes } from './auth/authRoutes'
import { dashboardRoutes } from './dashboard/dashboardRoutes'
import { settingsRoutes } from './settings/settingsRoutes'
import { useAuthStore } from '@/stores/auth/authStore'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
  }
}

// Authenticated pages render inside the app shell (navbar + live stream).
const appShell: RouteRecordRaw = {
  path: '/',
  component: () => import('@/components/TheAppLayout.vue'),
  children: [{ ...dashboardRoutes, path: '' }, settingsRoutes],
}

const router = createRouter({
  history: createWebHistory(),
  routes: [appShell, ...authRoutes],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Restore the session once on app load (retried while it is in the `error` state).
  if (auth.sessionState !== 'ready') await auth.checkAuth()
  // Server unreachable: stay put; SessionOverlay offers a retry.
  if (auth.sessionState === 'error') return false

  if (to.meta.requiresAuth && !auth.isAuthed) return { name: 'login' }
  if (to.meta.guestOnly && auth.isAuthed) return { name: 'dashboard' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Smart Door` : 'Smart Door'
})

export default router
