import type { RouteRecordRaw } from 'vue-router'

export const settingsRoutes: RouteRecordRaw = {
  path: '/settings',
  name: 'settings',
  component: () => import('@/views/settings/settingsMain.vue'),
  meta: { requiresAuth: true, title: 'Settings' },
}
