import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import {
    type ErrorBody,
    TEST_PASSWORD,
    deleteUser,
    deviceFingerprint,
    otherFingerprint,
    seedUser,
} from "../../../test/helpers"

import type { DashboardSummaryResponse } from "../types"

describe("Dashboard Summary Integration Test", () => {
    const app = createHonoApp()

    const USERNAME = "test-dashboard-user"
    const DEVICE_ID = "front_gate"
    const DAY_MS = 24 * 60 * 60 * 1000
    const HOUR_MS = 60 * 60 * 1000

    const utcDayStart = () => {
        const now = new Date()
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    }

    const loginAndGetCredentials = async () => {
        const loginRes = await app.request("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Fingerprint": deviceFingerprint,
            },
            body: JSON.stringify({ username: USERNAME, password: TEST_PASSWORD }),
        })
        expect(loginRes.status).toBe(200)

        const rawCookies = loginRes.headers.getSetCookie()
        const cookieHeader = rawCookies.map((cookie) => cookie.split(";")[0]).join("; ")
        const csrfCookiePair = rawCookies.find((cookie) => cookie.startsWith("csrfToken="))
        const csrfToken = csrfCookiePair?.split(";")[0]!.replace("csrfToken=", "") ?? ""

        return { cookieHeader, csrfToken }
    }

    const authedHeaders = (cookieHeader: string, csrfToken: string, fingerprint?: string) => ({
        "Cookie": cookieHeader,
        "X-CSRF-Token": csrfToken,
        "X-Fingerprint": fingerprint ?? deviceFingerprint,
    })

    const getSummary = (headers: Record<string, string>) =>
        app.request("/dashboard/summary", { method: "GET", headers })

    const seedEvent = (
        outcome: "GRANTED" | "DENIED" | "ADMIN_UNLOCK",
        timestampMs: number,
        fingerprintSlot: number | null = outcome === "GRANTED" ? 1 : null,
    ) =>
        db.orm.public.AccessEvent.create({
            deviceId: DEVICE_ID,
            outcome,
            fingerprintSlot,
            timestamp: new Date(timestampMs).toISOString(),
        })

    const clearEvents = async () => {
        for (const { id } of await db.orm.public.AccessEvent.all()) {
            await db.orm.public.AccessEvent.where({ id }).delete()
        }
    }

    const loginAndGetSummary = async () => {
        await seedUser(USERNAME)
        const { cookieHeader, csrfToken } = await loginAndGetCredentials()
        const res = await getSummary(authedHeaders(cookieHeader, csrfToken))
        return { res, json: await res.json() as DashboardSummaryResponse }
    }

    beforeEach(async () => {
        await deleteUser(USERNAME)
        await clearEvents()
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
        await clearEvents()
    })

    describe("happy path", () => {
        it("should return zero counts and empty history when there are no events", async () => {
            const { res, json } = await loginAndGetSummary()

            expect(res.status).toBe(200)
            expect(json).toEqual({
                accessGrantedToday: 0,
                accessDeniedToday: 0,
                lastEventAt: null,
                recentHistory: [],
            })
        })

        it("should split today's counts by outcome and count ADMIN_UNLOCK as granted", async () => {
            const base = utcDayStart() + 1000
            await seedEvent("GRANTED", base)
            await seedEvent("GRANTED", base + 1000)
            await seedEvent("ADMIN_UNLOCK", base + 2000)
            await seedEvent("DENIED", base + 3000)
            await seedEvent("DENIED", base + 4000)
            await seedEvent("DENIED", base + 5000)

            const { res, json } = await loginAndGetSummary()

            expect(res.status).toBe(200)
            expect(json.accessGrantedToday).toBe(3)
            expect(json.accessDeniedToday).toBe(3)
            expect(json.recentHistory).toHaveLength(6)
        })

        it("should only count events inside the current UTC day", async () => {
            const dayStart = utcDayStart()
            await seedEvent("GRANTED", dayStart) // first instant of today: counted
            await seedEvent("DENIED", dayStart - 1) // last ms of yesterday: not counted
            await seedEvent("GRANTED", dayStart + DAY_MS) // first instant of tomorrow: not counted

            const { json } = await loginAndGetSummary()

            expect(json.accessGrantedToday).toBe(1)
            expect(json.accessDeniedToday).toBe(0)
        })

        it("should return events from previous days in history without counting them", async () => {
            const yesterday = utcDayStart() - HOUR_MS
            await seedEvent("DENIED", yesterday)

            const { json } = await loginAndGetSummary()

            expect(json.accessDeniedToday).toBe(0)
            expect(json.recentHistory).toHaveLength(1)
            expect(json.lastEventAt).toBe(new Date(yesterday).toISOString())
        })

        it("should cap history at 30 events, newest first, with lastEventAt as the newest", async () => {
            const base = utcDayStart() - 100 * 1000
            for (let i = 0; i < 35; i++) {
                await seedEvent("DENIED", base + i * 1000)
            }

            const { json } = await loginAndGetSummary()

            expect(json.recentHistory).toHaveLength(30)
            const timestamps = json.recentHistory.map((event) => new Date(event.timestamp).getTime())
            expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))
            expect(timestamps[0]).toBe(base + 34 * 1000)
            expect(timestamps[29]).toBe(base + 5 * 1000)
            expect(json.lastEventAt).toBe(new Date(base + 34 * 1000).toISOString())
        })

        it("should include deviceLabel and a null slot for non-GRANTED events", async () => {
            const ts = utcDayStart() + 1000
            await seedEvent("GRANTED", ts, 4)
            await seedEvent("DENIED", ts + 1000)

            const { json } = await loginAndGetSummary()
            const [denied, granted] = json.recentHistory

            expect(denied).toMatchObject({
                deviceId: DEVICE_ID,
                deviceLabel: "Front Gate",
                outcome: "DENIED",
                fingerprintSlot: null,
            })
            expect(granted).toMatchObject({
                outcome: "GRANTED",
                fingerprintSlot: 4,
                timestamp: new Date(ts).toISOString(),
            })
        })
    })

    describe("authentication", () => {
        it.each([
            {
                testCase: "no session cookie",
                buildHeaders: async () => {
                    await seedUser(USERNAME)
                    const { csrfToken } = await loginAndGetCredentials()
                    return {
                        "X-CSRF-Token": csrfToken,
                        "X-Fingerprint": deviceFingerprint,
                    }
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "no X-CSRF-Token header",
                buildHeaders: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader } = await loginAndGetCredentials()
                    return {
                        "Cookie": cookieHeader,
                        "X-Fingerprint": deviceFingerprint,
                    }
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "mismatched CSRF token",
                buildHeaders: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader } = await loginAndGetCredentials()
                    return authedHeaders(cookieHeader, "this-does-not-match")
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "invalid device fingerprint",
                buildHeaders: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader, csrfToken } = await loginAndGetCredentials()
                    return authedHeaders(cookieHeader, csrfToken, "[123xyz]{invalid}")
                },
                expectedCode: "INVALID_DEVICE_ID",
                expectedStatus: 400,
            },
            {
                testCase: "fingerprint does not match session token",
                buildHeaders: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader, csrfToken } = await loginAndGetCredentials()
                    return authedHeaders(cookieHeader, csrfToken, otherFingerprint)
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
        ])("should return $expectedCode and no data if $testCase", async ({
            buildHeaders,
            expectedCode,
            expectedStatus,
        }) => {
            await seedEvent("GRANTED", utcDayStart() + 1000)

            const res = await getSummary(await buildHeaders())
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(expectedStatus)
            expect(json.error.code).toBe(expectedCode)
            expect(json).not.toHaveProperty("recentHistory")
        })
    })
})
