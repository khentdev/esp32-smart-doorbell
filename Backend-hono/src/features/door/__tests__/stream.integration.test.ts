import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test"

import { env } from "../../../config/env"
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

import type { FingerprintJobDTO, FingerprintJobEventDTO } from "../../fingerprints/types"
import { accessEventListenerCount, fingerprintEventListenerCount, subscribeToAccessEvents } from "../events"
import type { AccessEventDTO } from "../types"

describe("Door Stream Integration Test", () => {
    const app = createHonoApp()

    const USERNAME = "test-stream-user"
    const DEVICE_ID = "front_gate"
    const READ_TIMEOUT_MS = 2000

    let cookieHeader = ""
    let csrfToken = ""

    const login = async () => {
        const res = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Fingerprint": deviceFingerprint },
            body: JSON.stringify({ username: USERNAME, password: TEST_PASSWORD }),
        })
        expect(res.status).toBe(200)
        const rawCookies = res.headers.getSetCookie()
        cookieHeader = rawCookies.map((cookie) => cookie.split(";")[0]).join("; ")
        csrfToken =
            rawCookies.find((c) => c.startsWith("csrfToken="))?.split(";")[0]!.replace("csrfToken=", "") ?? ""
    }

    const streamUrl = (fingerprint: string | null = deviceFingerprint) =>
        fingerprint === null
            ? "/door/stream"
            : `/door/stream?fingerprint=${encodeURIComponent(fingerprint)}`

    const getStream = (url = streamUrl(), headers: Record<string, string> = { Cookie: cookieHeader }) =>
        app.request(url, { method: "GET", headers })

    const postAccess = (body: unknown) =>
        app.request("/door/access", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": env.DEVICE_API_KEY },
            body: JSON.stringify(body),
        })

    // Reads from an open stream until `predicate(buffer)` is true, or fails after a timeout.
    const makeReader = (res: Response) => {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        const readUntil = async (predicate: (buffer: string) => boolean) => {
            const deadline = Date.now() + READ_TIMEOUT_MS
            while (!predicate(buffer)) {
                const remaining = deadline - Date.now()
                if (remaining <= 0) throw new Error(`Timed out waiting on stream. Buffer so far: ${JSON.stringify(buffer)}`)
                let timer: ReturnType<typeof setTimeout> | undefined
                const chunk = await Promise.race([
                    reader.read(),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(
                            () => reject(new Error(`Timed out waiting on stream. Buffer so far: ${JSON.stringify(buffer)}`)),
                            remaining,
                        )
                    }),
                ]).finally(() => clearTimeout(timer))
                if (chunk.done) throw new Error(`Stream ended. Buffer so far: ${JSON.stringify(buffer)}`)
                buffer += decoder.decode(chunk.value, { stream: true })
            }
            return buffer
        }

        return { readUntil, cancel: () => reader.cancel(), getBuffer: () => buffer }
    }

    // Parses every `event: access` block in the buffer.
    const parseAccessEvents = (buffer: string): AccessEventDTO[] =>
        buffer
            .split("\n\n")
            .filter((block) => block.startsWith("event: access\n"))
            .map((block) => JSON.parse(block.split("\n").find((l) => l.startsWith("data: "))!.slice("data: ".length)))

    // Parses every `event: fingerprint` block in the buffer.
    const parseFingerprintEvents = (buffer: string): FingerprintJobEventDTO[] =>
        buffer
            .split("\n\n")
            .filter((block) => block.startsWith("event: fingerprint\n"))
            .map((block) => JSON.parse(block.split("\n").find((l) => l.startsWith("data: "))!.slice("data: ".length)))

    const waitForListenerCount = async (expected: number) => {
        const deadline = Date.now() + READ_TIMEOUT_MS
        const settled = () =>
            accessEventListenerCount() === expected && fingerprintEventListenerCount() === expected
        while (!settled() && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 10))
        }
        expect(accessEventListenerCount()).toBe(expected)
        expect(fingerprintEventListenerCount()).toBe(expected)
    }

    const clearEvents = async () => {
        for (const { id } of await db.orm.public.AccessEvent.all()) {
            await db.orm.public.AccessEvent.where({ id }).delete()
        }
        for (const { id } of await db.orm.public.FingerprintJob.all()) {
            await db.orm.public.FingerprintJob.where({ id }).delete()
        }
    }

    const openStreams: Array<{ cancel: () => Promise<void> }> = []
    const open = async (url?: string, headers?: Record<string, string>) => {
        const res = await getStream(url, headers)
        expect(res.status).toBe(200)
        const reader = makeReader(res)
        openStreams.push(reader)
        await reader.readUntil((b) => b.includes(": connected\n\n"))
        return { res, reader }
    }

    beforeAll(async () => {
        await seedUser(USERNAME)
        await login()
    })

    beforeEach(async () => {
        await clearEvents()
    })

    afterEach(async () => {
        while (openStreams.length) await openStreams.pop()!.cancel().catch(() => {})
        await waitForListenerCount(0)
    })

    afterAll(async () => {
        await clearEvents()
        await deleteUser(USERNAME)
    })

    describe("authentication", () => {
        it("should return SESSION_UNAUTHORIZED if there is no session cookie", async () => {
            const res = await getStream(streamUrl(), {})
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
            expect(accessEventListenerCount()).toBe(0)
        })

        it("should return SESSION_UNAUTHORIZED if the session cookie is not validly signed", async () => {
            const res = await getStream(streamUrl(), { Cookie: "sid=not-a-signed-cookie" })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
        })

        it("should return INVALID_DEVICE_ID if the fingerprint query param is missing", async () => {
            const res = await getStream(streamUrl(null))
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("INVALID_DEVICE_ID")
        })

        it.each([
            { testCase: "not JSON", fingerprint: "not-json" },
            { testCase: "a JSON array", fingerprint: "[1,2]" },
            { testCase: "an empty object", fingerprint: "{}" },
            { testCase: "a JSON primitive", fingerprint: "42" },
        ])("should return INVALID_DEVICE_ID if the fingerprint is $testCase", async ({ fingerprint }) => {
            const res = await getStream(streamUrl(fingerprint))
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("INVALID_DEVICE_ID")
        })

        it("should return SESSION_UNAUTHORIZED if the fingerprint belongs to a different device", async () => {
            const res = await getStream(streamUrl(otherFingerprint))
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
            expect(accessEventListenerCount()).toBe(0)
        })

        it("should not accept the fingerprint from the X-Fingerprint header", async () => {
            const res = await getStream(streamUrl(null), {
                Cookie: cookieHeader,
                "X-Fingerprint": deviceFingerprint,
            })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("INVALID_DEVICE_ID")
        })

        it("should not require a CSRF header", async () => {
            expect(csrfToken).not.toBe("")
            const { res } = await open() // no X-CSRF-Token sent

            expect(res.status).toBe(200)
        })
    })

    describe("stream", () => {
        it("should respond with SSE headers", async () => {
            const { res } = await open()

            expect(res.headers.get("Content-Type")).toStartWith("text/event-stream")
            expect(res.headers.get("Cache-Control")).toBe("no-cache")
            expect(res.headers.get("X-Accel-Buffering")).toBe("no")
        })

        it("should deliver an event reported through POST /door/access", async () => {
            const { reader } = await open()

            const reported = await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 2 })
            const body = await reported.json() as AccessEventDTO
            expect(reported.status).toBe(201)

            const buffer = await reader.readUntil((b) => b.includes("event: access"))
            expect(buffer).toContain("event: access\ndata: ")
            expect(parseAccessEvents(buffer)).toEqual([body])
        })

        it.each([
            { outcome: "GRANTED", body: { deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 1 }, slot: 1 },
            { outcome: "DENIED", body: { deviceId: DEVICE_ID, outcome: "DENIED" }, slot: null },
            { outcome: "ADMIN_UNLOCK", body: { deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK" }, slot: null },
        ])("should deliver a $outcome event with its slot", async ({ outcome, body, slot }) => {
            const { reader } = await open()

            await postAccess(body)

            const buffer = await reader.readUntil((b) => b.includes("event: access"))
            const [event] = parseAccessEvents(buffer)
            expect(event!.outcome).toBe(outcome as AccessEventDTO["outcome"])
            expect(event!.fingerprintSlot).toBe(slot)
            expect(event!.deviceLabel).toBe("Front Gate")
        })

        it("should deliver events in the order they were reported", async () => {
            const { reader } = await open()

            await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })
            await postAccess({ deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK" })

            const buffer = await reader.readUntil((b) => parseAccessEvents(b).length >= 2)
            expect(parseAccessEvents(buffer).map((e) => e.outcome)).toEqual(["DENIED", "ADMIN_UNLOCK"])
        })

        it("should not replay events reported before the stream was opened", async () => {
            await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })

            const { reader } = await open()
            await postAccess({ deviceId: DEVICE_ID, outcome: "ADMIN_UNLOCK" })

            const buffer = await reader.readUntil((b) => b.includes("event: access"))
            expect(parseAccessEvents(buffer).map((e) => e.outcome)).toEqual(["ADMIN_UNLOCK"])
        })

        it("should deliver the same event to every open stream", async () => {
            const first = await open()
            const second = await open()
            expect(accessEventListenerCount()).toBe(2)

            const reported = await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })
            const body = await reported.json() as AccessEventDTO

            for (const { reader } of [first, second]) {
                const buffer = await reader.readUntil((b) => b.includes("event: access"))
                expect(parseAccessEvents(buffer)).toEqual([body])
            }
        })

        it("should not receive events that were rejected", async () => {
            const { reader } = await open()

            await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED" }) // missing slot -> 400
            await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })

            const buffer = await reader.readUntil((b) => b.includes("event: access"))
            expect(parseAccessEvents(buffer).map((e) => e.outcome)).toEqual(["DENIED"])
        })

        it("should send a heartbeat comment while idle", async () => {
            const { reader } = await open()

            const buffer = await reader.readUntil((b) => b.includes(": ping\n\n"))
            expect(buffer).not.toContain("event:")
        })

        it("should deliver fingerprint job events alongside access events", async () => {
            const { reader } = await open()

            const enrollRes = await app.request("/fingerprints", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: cookieHeader,
                    "X-CSRF-Token": csrfToken,
                    "X-Fingerprint": deviceFingerprint,
                },
                body: JSON.stringify({ deviceId: DEVICE_ID, name: "Stream Person" }),
            })
            expect(enrollRes.status).toBe(202)
            const job = await enrollRes.json() as FingerprintJobDTO

            const buffer = await reader.readUntil((b) => b.includes("event: fingerprint"))
            const [event] = parseFingerprintEvents(buffer)
            expect(event!.job).toEqual(job)
            expect(event!.fingerprint).toBeNull()
            expect(parseAccessEvents(buffer)).toHaveLength(0)
        })
    })

    describe("cleanup", () => {
        it("should unsubscribe when the client disconnects and keep serving other clients", async () => {
            const gone = await open()
            const stays = await open()
            expect(accessEventListenerCount()).toBe(2)

            await gone.reader.cancel()
            await waitForListenerCount(1)

            const res = await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })
            expect(res.status).toBe(201)
            const buffer = await stays.reader.readUntil((b) => b.includes("event: access"))
            expect(parseAccessEvents(buffer)).toHaveLength(1)
        })

        it("should still return 201 and deliver to healthy streams if another subscriber throws", async () => {
            const { reader } = await open()
            const unsubscribe = subscribeToAccessEvents(() => {
                throw new Error("listener blew up")
            })

            try {
                const res = await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })
                expect(res.status).toBe(201)

                const buffer = await reader.readUntil((b) => b.includes("event: access"))
                expect(parseAccessEvents(buffer)).toHaveLength(1)
            } finally {
                unsubscribe()
            }
        })
    })
})
