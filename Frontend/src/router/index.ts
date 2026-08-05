// Re-import feature routes and merge them 
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authRoutes } from '../features/auth/routes';

const appRoutes: RouteRecordRaw[] = [
    ...authRoutes,
]


const router = createRouter({
    history: createWebHistory(),
    routes: appRoutes,
})

router.beforeEach((to, from, next) => {
    const isDev = import.meta.env.DEV
    if (isDev) console.log("Guard entry:", {
        original: to.fullPath,
        toName: to.name,
        toPath: to.path,
        fromName: from.name,
    });

    return next()
})

export default router
