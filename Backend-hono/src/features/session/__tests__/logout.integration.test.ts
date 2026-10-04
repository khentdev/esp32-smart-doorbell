import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import createHonoApp from "../../../createHonoApp"
import {
    type ErrorBody,
    TEST_PASSWORD,
    deleteUser,
    deviceFingerprint,
    seedUser,
} from "../../../test/helpers"

describe("Logout Integration Test", () => {
    const app = createHonoApp()
    const USERNAME = "test-logout-user"

    const loginAndGetCredentials = async () => {
        const loginRes = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Fingerprint": deviceFingerprint },
            body: JSON.stringify({ username: USERNAME, password: TEST_PASSWORD }),
        })
        expect(loginRes.status).toBe(200)

        const rawCookies = loginRes.headers.getSetCookie()
        const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ")
        const csrfToken = rawCookies
            .find((c) => c.startsWith("csrfToken="))
            ?.split(";")[0]!.replace("csrfToken=", "") ?? ""

        return { cookieHeader, csrfToken }
    }

    const logout = (headers: Record<string, string>) =>
        app.request("/session/logout", { method: "DELETE", headers })

    beforeEach(async () => {
        await deleteUser(USERNAME)
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
    })

    describe("happy path", () => {
        it("should clear session cookies and return success message", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const res = await logout({
                "Cookie": cookieHeader,
                "X-CSRF-Token": csrfToken,
                "X-Fingerprint": deviceFingerprint,
            })
            expect(res.status).toBe(200)

            const json = await res.json() as { message: string }
            expect(json.message).toBe("Logged out successfully.")

            const cookies = res.headers.getSetCookie()
            expect(cookies.find((c) => c.startsWith("sid="))).toMatch(/Max-Age=0/i)
            expect(cookies.find((c) => c.startsWith("csrfToken="))).toMatch(/Max-Age=0/i)
        })

        it("should reject session lookup when client has no cookies after logout", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const logoutRes = await logout({
                "Cookie": cookieHeader,
                "X-CSRF-Token": csrfToken,
                "X-Fingerprint": deviceFingerprint,
            })
            expect(logoutRes.status).toBe(200)

            const sessionRes = await app.request("/session/me", {
                method: "GET",
                headers: { "X-Fingerprint": deviceFingerprint },
            })
            const json = await sessionRes.json() as ErrorBody

            expect(sessionRes.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
        })
    })

    describe("validation", () => {
        it.each([
            {
                testCase: "no session cookie",
                buildRequest: () => logout({
                    "X-CSRF-Token": "some-csrf-token",
                    "X-Fingerprint": deviceFingerprint,
                }),
            },
            {
                testCase: "mismatched CSRF token",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader } = await loginAndGetCredentials()
                    return logout({
                        "Cookie": cookieHeader,
                        "X-CSRF-Token": "this-does-not-match",
                        "X-Fingerprint": deviceFingerprint,
                    })
                },
            },
        ])("should return SESSION_UNAUTHORIZED if $testCase", async ({ buildRequest }) => {
            const res = await buildRequest()
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
        })
    })
})
