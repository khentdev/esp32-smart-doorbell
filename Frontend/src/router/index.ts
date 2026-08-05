// Re-import feature routes and merge them 
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authRoutes } from '../features/auth/routes';
import { appRoutes } from '../features/app/routes.ts';

const routes: RouteRecordRaw[] = [

    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import("../shared/pages/NotFoundView.vue"),
    },

    ...appRoutes,
    ...authRoutes,
]


const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from) => {
    const isDev = import.meta.env.DEV
    if (isDev) console.log("Guard entry:", {
        original: to.fullPath,
        toName: to.name,
        toPath: to.path,
        fromName: from.name,
    });
})

export default router
