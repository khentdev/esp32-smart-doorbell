import { describe, expect, it } from "bun:test"
import { Hono } from "hono"

import { env } from "../../config/env"
import { type ErrorBody } from "../../test/helpers"
import authenticateDevice from "../authenticateDevice"
import { globalErrorHandler } from "../globalErrorHandler"

describe("Authenticate Device Middleware", () => {
    const app = new Hono()
    app.onError(globalErrorHandler)
    app.get("/protected", authenticateDevice, (c) => c.json({ ok: true }))

    const getProtected = (headers?: HeadersInit) =>
        app.request("/protected", { method: "GET", headers })

    it("should let the request through with the correct API key", async () => {
        const res = await getProtected({ "X-API-Key": env.DEVICE_API_KEY })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it.each<{ testCase: string; headers: Record<string, string> }>([
        { testCase: "the API key is missing", headers: {} },
        { testCase: "the API key is empty", headers: { "X-API-Key": "" } },
        { testCase: "the API key is wrong", headers: { "X-API-Key": "definitely-not-the-key" } },
        {
            testCase: "the API key is only a prefix of the real key",
            headers: { "X-API-Key": env.DEVICE_API_KEY.slice(0, -1) },
        },
        {
            testCase: "the API key has extra characters appended",
            headers: { "X-API-Key": `${env.DEVICE_API_KEY}x` },
        },
    ])("should return DEVICE_UNAUTHORIZED if $testCase", async ({ headers }) => {
        const res = await getProtected(headers)
        const json = await res.json() as ErrorBody

        expect(res.status).toBe(401)
        expect(json.error.code).toBe("DEVICE_UNAUTHORIZED")
    })
})
