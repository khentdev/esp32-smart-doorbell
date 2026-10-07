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

import type { ManualDoorUnlockResponse } from "../types"

describe("Manual Door Unlock Integration Test", () => {
    const app = createHonoApp()

    const USERNAME = "test-door-user"
    const DEVICE_ID = "front_gate"

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

    const postUnlock = (
        headers: Record<string, string>,
        body: unknown = { deviceId: DEVICE_ID },
    ) =>
        app.request("/door/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(body),
        })

    const authedHeaders = (cookieHeader: string, csrfToken: string, fingerprint?: string) => ({
        "Cookie": cookieHeader,
        "X-CSRF-Token": csrfToken,
        "X-Fingerprint": fingerprint ?? deviceFingerprint,
    })

    const getCommands = () => db.orm.public.DeviceCommand.all()

    // Test DB only: clear every row so a stray deviceId can never leak between tests.
    const clearCommands = async () => {
        for (const { deviceId } of await getCommands()) {
            await db.orm.public.DeviceCommand.where({ deviceId }).delete()
        }
    }

    beforeEach(async () => {
        await deleteUser(USERNAME)
        await clearCommands()
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
        await clearCommands()
    })

    describe("happy path", () => {
        it("should return 202 and store a pending unlock command for the device", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const before = Date.now()
            const res = await postUnlock(authedHeaders(cookieHeader, csrfToken))

            expect(res.status).toBe(202)
            expect(await res.json() as ManualDoorUnlockResponse).toEqual({
                status: "UNLOCK_REQUESTED",
            })

            const commands = await getCommands()
            expect(commands).toHaveLength(1)
            expect(commands[0]!.deviceId).toBe(DEVICE_ID)
            expect(commands[0]!.pendingUnlockAt).not.toBeNull()
            expect(new Date(commands[0]!.pendingUnlockAt!).getTime()).toBeGreaterThanOrEqual(before - 1000)
        })

        it("should keep a single command row and move pendingUnlockAt forward on a repeated unlock", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()
            const headers = authedHeaders(cookieHeader, csrfToken)

            expect((await postUnlock(headers)).status).toBe(202)
            const [first] = await getCommands()

            await Bun.sleep(20)

            expect((await postUnlock(headers)).status).toBe(202)
            const commands = await getCommands()

            expect(commands).toHaveLength(1)
            expect(new Date(commands[0]!.pendingUnlockAt!).getTime())
                .toBeGreaterThan(new Date(first!.pendingUnlockAt!).getTime())
        })
    })

    describe("validation", () => {
        it.each([
            { testCase: "an unknown deviceId", deviceId: "back_door" },
            { testCase: "an Object.prototype key (constructor)", deviceId: "constructor" },
            { testCase: "an Object.prototype key (__proto__)", deviceId: "__proto__" },
            { testCase: "an empty deviceId", deviceId: "" },
        ])("should return UNKNOWN_DEVICE_ID if deviceId is $testCase", async ({ deviceId }) => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const res = await postUnlock(authedHeaders(cookieHeader, csrfToken), { deviceId })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("UNKNOWN_DEVICE_ID")
            expect(await getCommands()).toHaveLength(0)
        })

        it("should not return a server error if deviceId is missing from the body", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const res = await postUnlock(authedHeaders(cookieHeader, csrfToken), {})

            expect(res.status).toBe(400)
            expect(await getCommands()).toHaveLength(0)
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
        ])("should return $expectedCode and not create a command if $testCase", async ({
            buildHeaders,
            expectedCode,
            expectedStatus,
        }) => {
            const res = await postUnlock(await buildHeaders())
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(expectedStatus)
            expect(json.error.code).toBe(expectedCode)
            expect(await getCommands()).toHaveLength(0)
        })
    })
})
