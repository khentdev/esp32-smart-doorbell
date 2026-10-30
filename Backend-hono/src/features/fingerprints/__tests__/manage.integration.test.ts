import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"

import createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import { type ErrorBody, deleteUser, otherFingerprint, seedUser } from "../../../test/helpers"

import { MAX_SLOT } from "../service"
import type { FingerprintDTO, FingerprintJobDTO, ListFingerprintsResponse } from "../types"
import {
    DEVICE_ID,
    clearFingerprintTables,
    getFingerprints,
    getJob,
    login,
    seedFingerprint,
    seedJob,
} from "./helpers"

describe("Fingerprint Management Integration Test", () => {
    const app = createHonoApp()
    const USERNAME = "test-fingerprints-user"

    let headers: Record<string, string> = {}

    const request = (method: string, path: string, body?: unknown, extraHeaders = headers) =>
        app.request(path, {
            method,
            headers: { "Content-Type": "application/json", ...extraHeaders },
            body: body === undefined ? undefined : JSON.stringify(body),
        })

    const list = () => request("GET", `/fingerprints?deviceId=${DEVICE_ID}`)
    const enroll = (name: unknown, deviceId: unknown = DEVICE_ID) =>
        request("POST", "/fingerprints", { deviceId, name })
    const rename = (id: string, name: unknown) => request("PATCH", `/fingerprints/${id}`, { name })
    const remove = (id: string) => request("DELETE", `/fingerprints/${id}`)

    const expectError = async (res: Response, status: number, code: string) => {
        expect(res.status).toBe(status)
        expect((await res.json() as ErrorBody).error.code).toBe(code)
    }

    beforeAll(async () => {
        await deleteUser(USERNAME)
        await seedUser(USERNAME)
        headers = await login(app, USERNAME)
    })

    beforeEach(async () => {
        await clearFingerprintTables()
    })

    afterAll(async () => {
        await clearFingerprintTables()
        await deleteUser(USERNAME)
    })

    describe("GET /fingerprints", () => {
        it("should return an empty list and no active job", async () => {
            const res = await list()
            expect(res.status).toBe(200)
            expect(await res.json() as ListFingerprintsResponse).toEqual({ fingerprints: [], activeJob: null })
        })

        it("should list people oldest first and include the active job", async () => {
            const juan = await seedFingerprint("Juan", 1)
            const ana = await seedFingerprint("Ana", 2)
            const job = await seedJob({ status: "SENT", slot: 3, sentAgoSeconds: 1 })

            const body = await (await list()).json() as ListFingerprintsResponse

            expect(body.fingerprints.map((f) => f.id)).toEqual([juan.id, ana.id])
            expect(body.fingerprints[0]).toEqual({
                id: juan.id,
                deviceId: DEVICE_ID,
                name: "Juan",
                slot: 1,
                createdAt: new Date(juan.createdAt).toISOString(),
            })
            expect(body.activeJob?.id).toBe(job.id)
        })

        it("should not report finished jobs as active", async () => {
            await seedJob({ status: "SUCCEEDED" })
            await seedJob({ status: "FAILED" })

            expect((await (await list()).json() as ListFingerprintsResponse).activeJob).toBeNull()
        })

        it("should expire a PENDING job the device never picked up", async () => {
            const job = await seedJob({ createdAgoSeconds: 120 })

            const body = await (await list()).json() as ListFingerprintsResponse

            expect(body.activeJob).toBeNull()
            expect((await getJob(job.id))!.status).toBe("EXPIRED")
        })

        it("should fail a SENT job the device never finished with DEVICE_TIMEOUT", async () => {
            const job = await seedJob({ status: "SENT", createdAgoSeconds: 300, sentAgoSeconds: 300 })

            const body = await (await list()).json() as ListFingerprintsResponse

            expect(body.activeJob).toBeNull()
            const row = await getJob(job.id)
            expect(row!.status).toBe("FAILED")
            expect(row!.error).toBe("DEVICE_TIMEOUT")
        })

        it("should keep a recently sent job active even if it was created long ago", async () => {
            const job = await seedJob({ status: "SENT", createdAgoSeconds: 300, sentAgoSeconds: 5 })

            expect((await (await list()).json() as ListFingerprintsResponse).activeJob?.id).toBe(job.id)
        })

        it("should return UNKNOWN_DEVICE_ID for an unknown or missing deviceId", async () => {
            await expectError(await request("GET", "/fingerprints?deviceId=back_door"), 400, "UNKNOWN_DEVICE_ID")
            await expectError(await request("GET", "/fingerprints"), 400, "UNKNOWN_DEVICE_ID")
        })
    })

    describe("POST /fingerprints", () => {
        it("should create a PENDING ENROLL job in slot 1 and not add the person yet", async () => {
            const res = await enroll("  Juan  ")
            expect(res.status).toBe(202)
            const job = await res.json() as FingerprintJobDTO

            expect(job).toMatchObject({
                deviceId: DEVICE_ID,
                type: "ENROLL",
                status: "PENDING",
                step: null,
                error: null,
                name: "Juan",
                slot: 1,
                fingerprintId: null,
            })
            expect(await getFingerprints()).toHaveLength(0)
        })

        it("should pick the lowest free slot", async () => {
            await seedFingerprint("One", 1)
            await seedFingerprint("Three", 3)

            const job = await (await enroll("Two")).json() as FingerprintJobDTO
            expect(job.slot).toBe(2)
        })

        it("should return FINGERPRINT_SLOTS_FULL when every slot is used", async () => {
            for (let slot = 1; slot <= MAX_SLOT; slot++) await seedFingerprint(`Person ${slot}`, slot)

            await expectError(await enroll("One too many"), 409, "FINGERPRINT_SLOTS_FULL")
        })

        it("should return FINGERPRINT_NAME_TAKEN for a case-insensitive duplicate", async () => {
            await seedFingerprint("Juan", 1)

            await expectError(await enroll("jUAN"), 409, "FINGERPRINT_NAME_TAKEN")
        })

        it.each(["PENDING", "SENT"] as const)(
            "should return FINGERPRINT_JOB_IN_PROGRESS while a job is %s",
            async (status) => {
                await seedJob({ status, sentAgoSeconds: status === "SENT" ? 1 : null })

                await expectError(await enroll("Juan"), 409, "FINGERPRINT_JOB_IN_PROGRESS")
            },
        )

        it("should allow a new job once the old one has expired", async () => {
            await seedJob({ createdAgoSeconds: 120 })

            expect((await enroll("Juan")).status).toBe(202)
        })

        it("should create exactly one job from concurrent requests", async () => {
            const results = await Promise.all(["A", "B", "C", "D"].map((name) => enroll(name)))

            expect(results.filter((r) => r.status === 202)).toHaveLength(1)
            expect(results.filter((r) => r.status === 409)).toHaveLength(3)
        })

        it.each([
            { testCase: "missing", name: undefined },
            { testCase: "blank", name: "   " },
            { testCase: "longer than 40 characters", name: "x".repeat(41) },
            { testCase: "not a string", name: 42 },
        ])("should return VALIDATION_ERROR when the name is $testCase", async ({ name }) => {
            await expectError(await enroll(name), 400, "VALIDATION_ERROR")
        })

        it("should return UNKNOWN_DEVICE_ID for an unknown device", async () => {
            await expectError(await enroll("Juan", "back_door"), 400, "UNKNOWN_DEVICE_ID")
        })

        it("should return INVALID_BODY for a body that is not JSON", async () => {
            const res = await app.request("/fingerprints", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: "{not json",
            })
            await expectError(res, 400, "INVALID_BODY")
        })
    })

    describe("PATCH /fingerprints/:id", () => {
        it("should rename the person without involving the device", async () => {
            const juan = await seedFingerprint("Juan", 1)

            const res = await rename(juan.id, "Juan D.")
            expect(res.status).toBe(200)
            expect((await res.json() as FingerprintDTO).name).toBe("Juan D.")
            expect((await getFingerprints())[0]!.name).toBe("Juan D.")
            expect(await db.orm.public.FingerprintJob.all()).toHaveLength(0)
        })

        it("should allow changing only the letter case of the same person's name", async () => {
            const juan = await seedFingerprint("juan", 1)

            expect((await rename(juan.id, "Juan")).status).toBe(200)
        })

        it("should return FINGERPRINT_NAME_TAKEN when another person has that name", async () => {
            await seedFingerprint("Ana", 1)
            const juan = await seedFingerprint("Juan", 2)

            await expectError(await rename(juan.id, "ana"), 409, "FINGERPRINT_NAME_TAKEN")
        })

        it("should return FINGERPRINT_NOT_FOUND for an unknown or malformed id", async () => {
            await expectError(await rename(crypto.randomUUID(), "Juan"), 404, "FINGERPRINT_NOT_FOUND")
            await expectError(await rename("not-a-uuid", "Juan"), 404, "FINGERPRINT_NOT_FOUND")
        })

        it("should return VALIDATION_ERROR for a blank name", async () => {
            const juan = await seedFingerprint("Juan", 1)

            await expectError(await rename(juan.id, " "), 400, "VALIDATION_ERROR")
        })
    })

    describe("DELETE /fingerprints/:id", () => {
        it("should create a PENDING DELETE job and keep the person until the device confirms", async () => {
            const juan = await seedFingerprint("Juan", 4)

            const res = await remove(juan.id)
            expect(res.status).toBe(202)
            expect(await res.json() as FingerprintJobDTO).toMatchObject({
                type: "DELETE",
                status: "PENDING",
                slot: 4,
                name: "Juan",
                fingerprintId: juan.id,
            })
            expect(await getFingerprints()).toHaveLength(1)
        })

        it("should return FINGERPRINT_JOB_IN_PROGRESS while another job is running", async () => {
            const juan = await seedFingerprint("Juan", 1)
            await seedJob({ slot: 2 })

            await expectError(await remove(juan.id), 409, "FINGERPRINT_JOB_IN_PROGRESS")
        })

        it("should return FINGERPRINT_NOT_FOUND for an unknown or malformed id", async () => {
            await expectError(await remove(crypto.randomUUID()), 404, "FINGERPRINT_NOT_FOUND")
            await expectError(await remove("not-a-uuid"), 404, "FINGERPRINT_NOT_FOUND")
        })
    })

    describe("authentication", () => {
        const withoutCookie = () => {
            const { Cookie: _, ...rest } = headers
            return rest
        }

        it.each([
            { testCase: "no session cookie", authed: withoutCookie },
            { testCase: "a different browser fingerprint", authed: () => ({ ...headers, "X-Fingerprint": otherFingerprint }) },
            { testCase: "a missing CSRF token", authed: () => ({ ...headers, "X-CSRF-Token": "" }) },
        ])("should reject every route with $testCase", async ({ authed: buildHeaders }) => {
            const juan = await seedFingerprint("Juan", 1)
            const authed: Record<string, string> = buildHeaders()

            const responses = await Promise.all([
                request("GET", `/fingerprints?deviceId=${DEVICE_ID}`, undefined, authed),
                request("POST", "/fingerprints", { deviceId: DEVICE_ID, name: "Ana" }, authed),
                request("PATCH", `/fingerprints/${juan.id}`, { name: "Ana" }, authed),
                request("DELETE", `/fingerprints/${juan.id}`, undefined, authed),
            ])

            for (const res of responses) expect(res.status).toBe(401)
            expect((await getFingerprints())[0]!.name).toBe("Juan")
        })
    })
})
