import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
    {
        path: "/auth",
        component: () => import("../../layouts/auth/AuthLayout.vue"),
        children: [
            {
                path: "login",
                name: "login",
                meta: { authPage: true },
                component: () => import("./pages/Login.vue"),
            },
        ],
    }
]