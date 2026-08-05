import type { RouteRecordRaw } from 'vue-router'

export const appRoutes: RouteRecordRaw[] = [

    {
        path: "/",
        name: "root",
        redirect: { name: "dashboard" },
        component: () => import("../../layouts/app/AppLayout.vue"),
        children: [
            {
                path: "dashboard",
                name: "dashboard",
                component: () => import("./pages/Dashboard.vue"),
            },
        ],
    }
]