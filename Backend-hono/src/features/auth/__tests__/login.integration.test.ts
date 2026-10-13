import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import createHonoApp from "../../../createHonoApp"
import {
    type ErrorBody,
    TEST_PASSWORD,
    deleteUser,
    deviceFingerprint,
    seedUser,
} from "../../../test/helpers"

import type { LoginInputRequestBody, LoginResponse } from "../types"

describe("Login Integration Test", () => {
    const app = createHonoApp()
    const USERNAME = "test-login-admin"

    const postLogin = (
        body: LoginInputRequestBody | Record<string, unknown>,
        deviceId?: string,
    ) =>
        app.request("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Fingerprint": deviceId ?? deviceFingerprint,
            },
            body: JSON.stringify(body),
        })

    beforeEach(async () => {
        await deleteUser(USERNAME)
    })

    afterAll(async () => {
        await deleteUser(USERNAME)
    })

    describe("happy path", () => {
        it("should login user, set session cookies and return user to client", async () => {
            const user = await seedUser(USERNAME)

            const res = await postLogin({ username: USERNAME, password: TEST_PASSWORD })
            expect(res.status).toBe(200)

            const json = await res.json() as LoginResponse
            expect(json.message).toBe("Logged in successfully")
            expect(json.data.user).toEqual({ username: user.username })

            const cookies = res.headers.getSetCookie()
            const sid = cookies.find((c) => c.startsWith("sid="))
            const csrf = cookies.find((c) => c.startsWith("csrfToken="))
            expect(sid).toBeDefined()
            expect(csrf).toBeDefined()
            expect(sid).toMatch(/HttpOnly/i)
            expect(csrf).not.toMatch(/HttpOnly/i)
        })
    })

    describe("validation", () => {
        it.each([
            {
                testCase: "username is empty",
                body: { username: "", password: TEST_PASSWORD },
                deviceId: deviceFingerprint,
                code: "INVALID_USERNAME",
                status: 400,
            },
            {
                testCase: "password is empty",
                body: { username: USERNAME, password: "" },
                deviceId: deviceFingerprint,
                code: "INVALID_PASSWORD",
                status: 400,
            },
            {
                testCase: "invalid device fingerprint",
                body: { username: USERNAME, password: TEST_PASSWORD },
                deviceId: "[][1}11q",
                status: 400,
                code: "INVALID_DEVICE_ID",
            },
        ])("returns $code if $testCase", async ({ body, deviceId, code, status }) => {
            const res = await postLogin(body, deviceId)
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(status)
            expect(json.error.code).toBe(code)
        })
    })

    describe("malformed body", () => {
        it.each(["not json", ""])("returns INVALID_BODY (400) for body %p", async (body) => {
            const res = await app.request("/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Fingerprint": deviceFingerprint,
                },
                body,
            })
            const json = await res.json() as ErrorBody

            expect(res.status).toBe(400)
            expect(json.error.code).toBe("INVALID_BODY")
        })
    })

    describe("service failure", () => {
        it("should return INVALID_CREDENTIALS if user not found", async () => {
            const res = await postLogin({ username: "nonexistent-user", password: TEST_PASSWORD })
            expect(res.status).toBe(401)

            const json = await res.json() as ErrorBody
            expect(json.error.code).toBe("INVALID_CREDENTIALS")
        })

        it("should return INVALID_CREDENTIALS if password does not match", async () => {
            await seedUser(USERNAME)

            const res = await postLogin({ username: USERNAME, password: "wrong-password" })
            expect(res.status).toBe(401)

            const json = await res.json() as ErrorBody
            expect(json.error.code).toBe("INVALID_CREDENTIALS")
        })
    })
})
