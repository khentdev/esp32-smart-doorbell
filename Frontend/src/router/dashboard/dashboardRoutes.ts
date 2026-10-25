import type { RouteRecordRaw } from 'vue-router'

export const dashboardRoutes: RouteRecordRaw = {
  path: '/',
  name: 'dashboard',
  component: () => import('@/views/dashboard/dashboardMain.vue'),
  meta: { requiresAuth: true, title: 'Dashboard' },
}
