import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/loginViews.vue'),
    meta: { guestOnly: true, title: 'Sign in' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/errors/notFound.vue'),
    meta: { title: 'Not found' },
  },
]
