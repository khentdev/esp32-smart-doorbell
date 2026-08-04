import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import getRequestsOrigin from "./infra/corsOrigins.js";
import { registerAppRoutes } from "./routes/index.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";

function createHonoApp() {
    const app = new Hono()
    const allowedOrigins = getRequestsOrigin()

    app.onError(globalErrorHandler)
    app.use(secureHeaders({
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
        strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
        xFrameOptions: "DENY",
        xContentTypeOptions: "nosniff",
        referrerPolicy: "strict-origin-when-cross-origin",
        permissionsPolicy: {
            camera: ["()"],
            microphone: ["()"],
            geolocation: ["()"],
            payment: ["()"],
        },
    }))

    app.use(cors({
        origin(origin) {
            if (!origin) return null
            return allowedOrigins.includes(origin) ? origin : null
        },
        credentials: true,
        allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Fingerprint", "Accept", "Accept-Language"],
        exposeHeaders: [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        maxAge: 86400,
    }))

    registerAppRoutes(app)

    app.notFound((c) => c.json({ error: { message: 'Route not found', code: 'NOT_FOUND' } }, 404));
    return app
}

export default createHonoApp