import { afterAll, beforeEach, describe, expect, it } from "bun:test"
import { sign } from "hono/jwt"
import { serializeSigned } from "hono/utils/cookie"

import { env } from "../../../config/env"
import createHonoApp from "../../../createHonoApp"
import { hashData } from "../../../lib/hash"
import {
    type ErrorBody,
    TEST_PASSWORD,
    deleteUser,
    deviceFingerprint,
    otherFingerprint,
    seedUser,
} from "../../../test/helpers"

import type { LoginInputRequestBody } from "../../auth/types"

describe("Get Session Integration Test", () => {
    const app = createHonoApp()

    const USERNAME = "test-session-user"

    const postLogin = (
        overrides?: LoginInputRequestBody | Record<string, unknown>,
        deviceId?: string,
    ) =>
        app.request("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Fingerprint": deviceId ?? deviceFingerprint,
            },
            body: JSON.stringify({
                username: USERNAME,
                password: TEST_PASSWORD,
                ...overrides,
            }),
        })

    const loginAndGetCredentials = async () => {
        const loginRes = await postLogin()
        expect(loginRes.status).toBe(200)

        const rawCookies = loginRes.headers.getSetCookie()
        const cookieHeader = rawCookies.map((cookie) => cookie.split(";")[0]).join("; ")

        const csrfCookiePair = rawCookies.find((cookie) => cookie.startsWith("csrfToken="))
        const csrfToken = csrfCookiePair?.split(";")[0]!.replace("csrfToken=", "") ?? ""

        return { cookieHeader, csrfToken }
    }

    const getSession = (cookieHeader: string, csrfToken: string, deviceId?: string) =>
        app.request("/session/me", {
            method: "GET",
            headers: {
                "Cookie": cookieHeader,
                "X-CSRF-Token": csrfToken,
                "X-Fingerprint": deviceId ?? deviceFingerprint,
            },
        })

    const buildSignedSessionCookieStr = async (token: string): Promise<string> =>
        serializeSigned("sid", token, env.COOKIE_SECRET)

    beforeEach(async () => {
        await deleteUser(USERNAME)
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
    })

    describe("happy path", () => {
        it("should return user data without rotating tokens when the session token is not nearing expiration", async () => {
            const user = await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            const res = await getSession(cookieHeader, csrfToken)
            expect(res.status).toBe(200)

            const json = await res.json() as { user: Record<string, unknown> }
            expect(json.user).toEqual({
                username: user.username,
            })

            const responseCookies = res.headers.getSetCookie()
            expect(responseCookies.find((cookie) => cookie.startsWith("sid="))).toBeUndefined()
            expect(responseCookies.find((cookie) => cookie.startsWith("csrfToken="))).toBeUndefined()
        })

        it("should return user data and rotate tokens when the session token is near expiration", async () => {
            const user = await seedUser(USERNAME)

            const now = Math.floor(Date.now() / 1000)
            const nearExpiryToken = await sign({
                sub: user.id,
                deviceHash: hashData(deviceFingerprint),
                iat: now,
                exp: now + 1800,
                iss: env.JWT_ISSUER,
                nonce: "test1234",
            }, env.JWT_SECRET, "HS512")

            const csrfToken = "test-csrf-token"
            const signedSidCookieStr = await buildSignedSessionCookieStr(nearExpiryToken)

            const res = await app.request("/session/me", {
                method: "GET",
                headers: {
                    "Cookie": `${signedSidCookieStr}; csrfToken=${csrfToken}`,
                    "X-CSRF-Token": csrfToken,
                    "X-Fingerprint": deviceFingerprint,
                },
            })

            expect(res.status).toBe(200)

            const json = await res.json() as { user: { username: string } }
            expect(json.user.username).toBe(user.username)

            const responseCookies = res.headers.getSetCookie()
            expect(responseCookies.find((cookie) => cookie.startsWith("sid="))).toBeDefined()
            expect(responseCookies.find((cookie) => cookie.startsWith("csrfToken="))).toBeDefined()
        })
    })

    describe("validation", () => {
        it.each([
            {
                testCase: "no session cookie",
                buildRequest: () => app.request("/session/me", {
                    method: "GET",
                    headers: {
                        "X-CSRF-Token": "some-csrf-token",
                        "X-Fingerprint": deviceFingerprint,
                    },
                }),
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "no X-CSRF-Token header",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader } = await loginAndGetCredentials()
                    return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": cookieHeader,
                            "X-Fingerprint": deviceFingerprint,
                        },
                    })
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "no csrfToken cookie",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader, csrfToken } = await loginAndGetCredentials()
                    const sidOnlyCookie = cookieHeader
                        .split("; ")
                        .filter((cookie) => cookie.startsWith("sid="))
                        .join("; ")
                    return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": sidOnlyCookie,
                            "X-CSRF-Token": csrfToken,
                            "X-Fingerprint": deviceFingerprint,
                        },
                    })
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "mismatched CSRF token",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader } = await loginAndGetCredentials()
                    return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": cookieHeader,
                            "X-CSRF-Token": "this-does-not-match",
                            "X-Fingerprint": deviceFingerprint,
                        },
                    })
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "invalid device fingerprint",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader, csrfToken } = await loginAndGetCredentials()
                    return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": cookieHeader,
                            "X-CSRF-Token": csrfToken,
                            "X-Fingerprint": "[123xyz]{invalid}",
                        },
                    })
                },
                expectedCode: "INVALID_DEVICE_ID",
                expectedStatus: 400,
            },
            {
                testCase: "fingerprint does not match session token",
                buildRequest: async () => {
                    await seedUser(USERNAME)
                    const { cookieHeader, csrfToken } = await loginAndGetCredentials()
                                        return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": cookieHeader,
                            "X-CSRF-Token": csrfToken,
                            "X-Fingerprint": otherFingerprint,
                        },
                    })
                },
                expectedCode: "SESSION_UNAUTHORIZED",
                expectedStatus: 401,
            },
            {
                testCase: "session token is expired",
                buildRequest: async () => {
                    const user = await seedUser(USERNAME)
                    const now = Math.floor(Date.now() / 1000)
                    const expiredToken = await sign({
                        sub: user.id,
                                deviceHash: hashData(deviceFingerprint),
                        iat: now - 7200,
                        exp: now - 3600,
                        iss: env.JWT_ISSUER,
                        nonce: "expired1",
                    }, env.JWT_SECRET, "HS512")

                    const csrfToken = "test-csrf-token"
                    const signedSidCookieStr = await buildSignedSessionCookieStr(expiredToken)

                    return app.request("/session/me", {
                        method: "GET",
                        headers: {
                            "Cookie": `${signedSidCookieStr}; csrfToken=${csrfToken}`,
                            "X-CSRF-Token": csrfToken,
                            "X-Fingerprint": deviceFingerprint,
                        },
                    })
                },
                expectedCode: "TOKEN_EXPIRED",
                expectedStatus: 401,
            },
        ])("should return $expectedCode if $testCase", async ({ buildRequest, expectedCode, expectedStatus }) => {
            const res = await buildRequest()
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(expectedStatus)
            expect(json.error.code).toBe(expectedCode)
        })
    })

    describe("service failure", () => {
        it("should return SESSION_UNAUTHORIZED if user no longer exists in the database", async () => {
            await seedUser(USERNAME)
            const { cookieHeader, csrfToken } = await loginAndGetCredentials()

            await deleteUser(USERNAME)

            const res = await getSession(cookieHeader, csrfToken)
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(401)
            expect(json.error.code).toBe("SESSION_UNAUTHORIZED")
        })
    })
})
