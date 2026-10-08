import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import { env } from "../../../config/env"
import createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import {
    type ErrorBody,
    TEST_PASSWORD,
    deleteUser,
    deviceFingerprint,
    seedUser,
} from "../../../test/helpers"

import type { PollDeviceCommandResponse } from "../types"

describe("Poll Device Command Integration Test", () => {
    const app = createHonoApp()

    const USERNAME = "test-door-poll-user"
    const DEVICE_ID = "front_gate"
    const TTL_SECONDS = Number(env.UNLOCK_COMMAND_TTL_SECONDS)

    // apiKey: null omits the header entirely (an `undefined` would fall back to the valid key).
    const poll = ({
        query = `?deviceId=${DEVICE_ID}`,
        apiKey = env.DEVICE_API_KEY,
    }: { query?: string; apiKey?: string | null } = {}) =>
        app.request(`/door/commands${query}`, {
            method: "GET",
            headers: apiKey === null ? {} : { "X-API-Key": apiKey },
        })

    const pollCommand = async () => {
        const res = await poll()
        expect(res.status).toBe(200)
        return (await res.json() as PollDeviceCommandResponse).command
    }

    const seedCommand = (ageSeconds: number) => {
        const pendingUnlockAt = new Date(Date.now() - ageSeconds * 1000).toISOString()
        return db.orm.public.DeviceCommand.upsert({
            create: { deviceId: DEVICE_ID, pendingUnlockAt },
            update: { pendingUnlockAt },
        })
    }

    const getCommands = () => db.orm.public.DeviceCommand.all()

    // Clear every row so a stray deviceId can never leak between tests.
    const clearCommands = async () => {
        for (const { deviceId } of await getCommands()) {
            await db.orm.public.DeviceCommand.where({ deviceId }).delete()
        }
    }

    beforeEach(async () => {
        await clearCommands()
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
        await clearCommands()
    })

    describe("happy path", () => {
        it("should return UNLOCK for a fresh pending command and clear it", async () => {
            await seedCommand(1)

            expect(await pollCommand()).toBe("UNLOCK")

            const [row] = await getCommands()
            expect(row!.pendingUnlockAt).toBeNull()
        })

        it("should return null on a second poll because the command is consumed once", async () => {
            await seedCommand(1)

            expect(await pollCommand()).toBe("UNLOCK")
            expect(await pollCommand()).toBeNull()
        })

        it("should return null if no command row exists for the device", async () => {
            expect(await pollCommand()).toBeNull()
        })

        it("should still return UNLOCK for a command just inside the TTL", async () => {
            await seedCommand(TTL_SECONDS - 10)

            expect(await pollCommand()).toBe("UNLOCK")
        })
    })

    describe("expiry", () => {
        it("should return null for a command older than the TTL", async () => {
            await seedCommand(TTL_SECONDS + 60)

            expect(await pollCommand()).toBeNull()
        })

        it("should not let an expired command block a later fresh one", async () => {
            await seedCommand(TTL_SECONDS + 60)
            expect(await pollCommand()).toBeNull()

            await seedCommand(1)
            expect(await pollCommand()).toBe("UNLOCK")
        })
    })

    describe("atomicity", () => {
        it("should hand a single command to exactly one of many concurrent polls", async () => {
            for (let round = 0; round < 3; round++) {
                await seedCommand(1)

                const results = await Promise.all(
                    Array.from({ length: 8 }, async () => (await poll()).json() as Promise<PollDeviceCommandResponse>),
                )

                const winners = results.filter((result) => result.command === "UNLOCK")
                expect(winners).toHaveLength(1)
            }
        })
    })

    describe("validation", () => {
        it.each([
            { testCase: "an unknown deviceId", query: "?deviceId=back_door" },
            { testCase: "an Object.prototype key (constructor)", query: "?deviceId=constructor" },
            { testCase: "an Object.prototype key (__proto__)", query: "?deviceId=__proto__" },
            { testCase: "an empty deviceId", query: "?deviceId=" },
            { testCase: "a missing deviceId", query: "" },
        ])("should return UNKNOWN_DEVICE_ID if the request has $testCase", async ({ query }) => {
            const res = await poll({ query })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("UNKNOWN_DEVICE_ID")
        })
    })

    describe("authentication", () => {
        it.each([
            { testCase: "the API key is missing", apiKey: null },
            { testCase: "the API key is wrong", apiKey: "definitely-not-the-key" },
            { testCase: "the API key is truncated", apiKey: env.DEVICE_API_KEY.slice(0, -1) },
        ])("should return DEVICE_UNAUTHORIZED and not consume the command if $testCase", async ({ apiKey }) => {
            await seedCommand(1)

            const res = await poll({ apiKey })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("DEVICE_UNAUTHORIZED")

            const [row] = await getCommands()
            expect(row!.pendingUnlockAt).not.toBeNull()
        })
    })

    describe("end to end with manual unlock", () => {
        it("should deliver an admin unlock request to the device exactly once", async () => {
            await deleteUser(USERNAME)
            await seedUser(USERNAME)

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
            const csrfToken = rawCookies
                .find((cookie) => cookie.startsWith("csrfToken="))
                ?.split(";")[0]!.replace("csrfToken=", "") ?? ""

            expect(await pollCommand()).toBeNull()

            const unlockRes = await app.request("/door/unlock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": cookieHeader,
                    "X-CSRF-Token": csrfToken,
                    "X-Fingerprint": deviceFingerprint,
                },
                body: JSON.stringify({ deviceId: DEVICE_ID }),
            })
            expect(unlockRes.status).toBe(202)

            expect(await pollCommand()).toBe("UNLOCK")
            expect(await pollCommand()).toBeNull()
        })
    })
})
