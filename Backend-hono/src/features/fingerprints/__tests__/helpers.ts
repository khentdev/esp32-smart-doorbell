import { expect } from "bun:test"

import { env } from "../../../config/env"
import type createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import { TEST_PASSWORD, deviceFingerprint } from "../../../test/helpers"

import type { FingerprintJobType } from "../types"

type App = ReturnType<typeof createHonoApp>

export const DEVICE_ID = "front_gate"

export const login = async (app: App, username: string) => {
    const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Fingerprint": deviceFingerprint },
        body: JSON.stringify({ username, password: TEST_PASSWORD }),
    })
    expect(res.status).toBe(200)
    const rawCookies = res.headers.getSetCookie()
    const cookieHeader = rawCookies.map((cookie) => cookie.split(";")[0]).join("; ")
    const csrfToken =
        rawCookies.find((c) => c.startsWith("csrfToken="))?.split(";")[0]!.replace("csrfToken=", "") ?? ""
    return { Cookie: cookieHeader, "X-CSRF-Token": csrfToken, "X-Fingerprint": deviceFingerprint }
}

/** POST /door/jobs/:jobId/progress as the ESP32. */
export const reportProgress = (app: App, jobId: string, body: unknown, apiKey: string | null = env.DEVICE_API_KEY) =>
    app.request(`/door/jobs/${jobId}/progress`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey === null ? {} : { "X-API-Key": apiKey }),
        },
        body: JSON.stringify(body),
    })

/** GET /door/commands as the ESP32. */
export const poll = (app: App) =>
    app.request(`/door/commands?deviceId=${DEVICE_ID}`, {
        method: "GET",
        headers: { "X-API-Key": env.DEVICE_API_KEY },
    })

export const seedFingerprint = (name: string, slot: number) =>
    db.orm.public.Fingerprint.create({ deviceId: DEVICE_ID, slot, name })

/** Seeds a job directly, optionally backdated, to test expiry without waiting. */
export const seedJob = async ({
    type = "ENROLL",
    status = "PENDING",
    slot = 1,
    name = "Seeded",
    fingerprintId = null,
    createdAgoSeconds = 0,
    sentAgoSeconds = null,
}: {
    type?: FingerprintJobType
    status?: "PENDING" | "SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED"
    slot?: number
    name?: string
    fingerprintId?: string | null
    createdAgoSeconds?: number
    sentAgoSeconds?: number | null
} = {}) => {
    const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()
    const job = await db.orm.public.FingerprintJob.create({
        deviceId: DEVICE_ID,
        type,
        slot,
        name,
        fingerprintId,
        status,
        step: null,
        error: null,
        sentAt: sentAgoSeconds === null ? null : ago(sentAgoSeconds),
    })
    if (createdAgoSeconds > 0) {
        const plan = db.sql.public.FingerprintJob.update({ createdAt: ago(createdAgoSeconds) })
            .where((f, fns) => fns.eq(f.id, job.id))
            .build()
        await db.runtime().execute(plan)
    }
    return job
}

export const getJob = (id: string) => db.orm.public.FingerprintJob.first({ id })

export const getFingerprints = () => db.orm.public.Fingerprint.all()

/** Test DB only: clears every fingerprint-related row. */
export const clearFingerprintTables = async () => {
    for (const { id } of await db.orm.public.FingerprintJob.all()) {
        await db.orm.public.FingerprintJob.where({ id }).delete()
    }
    for (const { id } of await db.orm.public.Fingerprint.all()) {
        await db.orm.public.Fingerprint.where({ id }).delete()
    }
    for (const { id } of await db.orm.public.AccessEvent.all()) {
        await db.orm.public.AccessEvent.where({ id }).delete()
    }
    for (const { deviceId } of await db.orm.public.DeviceCommand.all()) {
        await db.orm.public.DeviceCommand.where({ deviceId }).delete()
    }
}
