import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import { env } from "../../../config/env"
import createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import type { ErrorBody } from "../../../test/helpers"

import { subscribeToAccessEvents } from "../events"
import type { AccessEventDTO } from "../types"

describe("Report Access Integration Test", () => {
    const app = createHonoApp()

    const DEVICE_ID = "front_gate"
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

    // apiKey: null omits the header entirely (an `undefined` would fall back to the valid key).
    // rawBody lets a test send something that is not JSON.
    const postAccess = (
        body: unknown,
        { apiKey = env.DEVICE_API_KEY, rawBody }: { apiKey?: string | null; rawBody?: string } = {},
    ) =>
        app.request("/door/access", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey === null ? {} : { "X-API-Key": apiKey }),
            },
            body: rawBody ?? JSON.stringify(body),
        })

    const getEvents = () => db.orm.public.AccessEvent.all()

    // Test DB only: clear every row so events never leak between tests.
    const clearEvents = async () => {
        for (const { id } of await getEvents()) {
            await db.orm.public.AccessEvent.where({ id }).delete()
        }
    }

    const collectPublished = () => {
        const published: AccessEventDTO[] = []
        const unsubscribe = subscribeToAccessEvents((event) => published.push(event))
        return { published, unsubscribe }
    }

    beforeEach(async () => {
        await clearEvents()
    })

    afterAll(async () => {
        await clearEvents()
    })

    describe("happy path", () => {
        it("should record a GRANTED event with its fingerprint slot and return 201", async () => {
            const before = Date.now()
            const res = await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 1 })

            expect(res.status).toBe(201)
            const json = await res.json() as AccessEventDTO
            expect(json.id).toMatch(UUID_PATTERN)
            expect(json.deviceId).toBe(DEVICE_ID)
            expect(json.deviceLabel).toBe("Front Gate")
            expect(json.outcome).toBe("GRANTED")
            expect(json.fingerprintSlot).toBe(1)
            expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
            expect(new Date(json.timestamp).getTime()).toBeGreaterThanOrEqual(before - 1000)

            const rows = await getEvents()
            expect(rows).toHaveLength(1)
            expect(rows[0]!.id).toBe(json.id)
            expect(rows[0]!.outcome).toBe("GRANTED")
            expect(rows[0]!.fingerprintSlot).toBe(1)
        })

        it.each([
            { testCase: "DENIED without a slot", body: { deviceId: DEVICE_ID, outcome: "DENIED" } },
            { testCase: "DENIED with a null slot", body: { deviceId: DEVICE_ID, outcome: "DENIED", fingerprintSlot: null } },
            { testCase: "ADMIN_UNLOCK without a slot", body: { deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK" } },
            { testCase: "ADMIN_UNLOCK with a null slot", body: { deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK", fingerprintSlot: null } },
        ])("should accept $testCase and store a null slot", async ({ body }) => {
            const res = await postAccess(body)

            expect(res.status).toBe(201)
            const json = await res.json() as AccessEventDTO
            expect(json.outcome).toBe(body.outcome as AccessEventDTO["outcome"])
            expect(json.fingerprintSlot).toBeNull()

            const rows = await getEvents()
            expect(rows).toHaveLength(1)
            expect(rows[0]!.fingerprintSlot).toBeNull()
        })

        it("should record every report as its own event because there is no debounce", async () => {
            const body = { deviceId: DEVICE_ID, outcome: "DENIED" }

            expect((await postAccess(body)).status).toBe(201)
            expect((await postAccess(body)).status).toBe(201)

            expect(await getEvents()).toHaveLength(2)
        })

        it("should ignore a client-supplied id and timestamp", async () => {
            const clientId = "00000000-0000-4000-8000-000000000000"
            const clientTimestamp = "2000-01-01T00:00:00.000Z"

            const res = await postAccess({
                deviceId: DEVICE_ID,
                outcome: "GRANTED",
                fingerprintSlot: 2,
                id: clientId,
                timestamp: clientTimestamp,
            })
            const json = await res.json() as AccessEventDTO

            expect(res.status).toBe(201)
            expect(json.id).not.toBe(clientId)
            expect(json.timestamp).not.toBe(clientTimestamp)
        })
    })

    describe("validation", () => {
        it.each([
            { testCase: "GRANTED without a slot", body: { deviceId: DEVICE_ID, outcome: "GRANTED" } },
            { testCase: "GRANTED with a null slot", body: { deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: null } },
            { testCase: "DENIED with a slot", body: { deviceId: DEVICE_ID, outcome: "DENIED", fingerprintSlot: 1 } },
            { testCase: "ADMIN_UNLOCK with a slot", body: { deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK", fingerprintSlot: 1 } },
            { testCase: "a lowercase outcome", body: { deviceId: DEVICE_ID, outcome: "granted", fingerprintSlot: 1 } },
            { testCase: "an unknown outcome", body: { deviceId: DEVICE_ID, outcome: "FOO" } },
            { testCase: "a missing outcome", body: { deviceId: DEVICE_ID } },
            { testCase: "a string slot", body: { deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: "1" } },
            { testCase: "a fractional slot", body: { deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 1.5 } },
            { testCase: "a negative slot", body: { deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: -1 } },
            { testCase: "a JSON body that is not an object", body: null },
        ])("should return VALIDATION_ERROR and record nothing for $testCase", async ({ body }) => {
            const res = await postAccess(body)
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("VALIDATION_ERROR")
            expect(await getEvents()).toHaveLength(0)
        })

        it.each([
            { testCase: "an unknown deviceId", body: { deviceId: "back_door", outcome: "DENIED" } },
            { testCase: "an Object.prototype key (constructor)", body: { deviceId: "constructor", outcome: "DENIED" } },
            { testCase: "an Object.prototype key (__proto__)", body: { deviceId: "__proto__", outcome: "DENIED" } },
            { testCase: "an empty deviceId", body: { deviceId: "", outcome: "DENIED" } },
            { testCase: "a missing deviceId", body: { outcome: "DENIED" } },
            { testCase: "a non-string deviceId", body: { deviceId: 123, outcome: "DENIED" } },
        ])("should return UNKNOWN_DEVICE_ID and record nothing for $testCase", async ({ body }) => {
            const res = await postAccess(body)
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("UNKNOWN_DEVICE_ID")
            expect(await getEvents()).toHaveLength(0)
        })

        it("should return INVALID_BODY and record nothing if the body is not valid JSON", async () => {
            const res = await postAccess(undefined, { rawBody: "{not json" })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("INVALID_BODY")
            expect(await getEvents()).toHaveLength(0)
        })
    })

    describe("authentication", () => {
        it.each([
            { testCase: "the API key is missing", apiKey: null },
            { testCase: "the API key is wrong", apiKey: "definitely-not-the-key" },
            { testCase: "the API key is truncated", apiKey: env.DEVICE_API_KEY.slice(0, -1) },
        ])("should return DEVICE_UNAUTHORIZED and record nothing if $testCase", async ({ apiKey }) => {
            const res = await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" }, { apiKey })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("DEVICE_UNAUTHORIZED")
            expect(await getEvents()).toHaveLength(0)
        })
    })

    describe("live publishing", () => {
        it("should publish exactly one event with the persisted id after a successful report", async () => {
            const { published, unsubscribe } = collectPublished()

            try {
                const res = await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 3 })
                const json = await res.json() as AccessEventDTO

                expect(res.status).toBe(201)
                expect(published).toEqual([json])
            } finally {
                unsubscribe()
            }
        })

        it("should publish nothing when the report is rejected", async () => {
            const { published, unsubscribe } = collectPublished()

            try {
                await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED" })
                await postAccess({ deviceId: "back_door", outcome: "DENIED" })
                await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" }, { apiKey: "bad-key" })

                expect(published).toHaveLength(0)
            } finally {
                unsubscribe()
            }
        })

        it("should still return 201 if a subscriber throws", async () => {
            const unsubscribe = subscribeToAccessEvents(() => {
                throw new Error("listener blew up")
            })

            try {
                const res = await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })

                expect(res.status).toBe(201)
                expect(await getEvents()).toHaveLength(1)
            } finally {
                unsubscribe()
            }
        })
    })
})
