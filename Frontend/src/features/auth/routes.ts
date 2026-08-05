import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
    {
        path: "/auth",
        name: "auth",
        redirect: { name: "login" },
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