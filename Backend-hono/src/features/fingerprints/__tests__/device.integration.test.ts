import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"

import { env } from "../../../config/env"
import createHonoApp from "../../../createHonoApp"
import { db } from "../../../prisma/db"
import { type ErrorBody, deleteUser, seedUser } from "../../../test/helpers"

import type { AccessEventDTO, PollDeviceCommandResponse } from "../../door/types"
import type { FingerprintJobDTO } from "../types"
import {
    DEVICE_ID,
    clearFingerprintTables,
    getFingerprints,
    getJob,
    login,
    poll,
    reportProgress,
    seedFingerprint,
    seedJob,
} from "./helpers"

describe("Fingerprint Device Flow Integration Test", () => {
    const app = createHonoApp()
    const USERNAME = "test-fingerprint-device-user"

    let headers: Record<string, string> = {}

    const pollCommand = async () => {
        const res = await poll(app)
        expect(res.status).toBe(200)
        return await res.json() as PollDeviceCommandResponse
    }

    const enroll = async (name: string) => {
        const res = await app.request("/fingerprints", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ deviceId: DEVICE_ID, name }),
        })
        expect(res.status).toBe(202)
        return await res.json() as FingerprintJobDTO
    }

    const report = async (jobId: string, body: Record<string, unknown>) =>
        reportProgress(app, jobId, { deviceId: DEVICE_ID, ...body })

    const reportOk = async (jobId: string, body: Record<string, unknown>) => {
        const res = await report(jobId, body)
        expect(res.status).toBe(200)
        return await res.json() as FingerprintJobDTO
    }

    const expectError = async (res: Response, status: number, code: string) => {
        expect(res.status).toBe(status)
        expect((await res.json() as ErrorBody).error.code).toBe(code)
    }

    const postAccess = async (body: unknown) => {
        const res = await app.request("/door/access", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": env.DEVICE_API_KEY },
            body: JSON.stringify(body),
        })
        expect(res.status).toBe(201)
        return await res.json() as AccessEventDTO
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

    describe("GET /door/commands", () => {
        it("should deliver an ENROLL job once and mark it SENT", async () => {
            const job = await enroll("Juan")

            expect(await pollCommand()).toEqual({ command: "ENROLL", jobId: job.id, slot: 1 })
            expect(await pollCommand()).toEqual({ command: null })

            const row = await getJob(job.id)
            expect(row!.status).toBe("SENT")
            expect(row!.sentAt).not.toBeNull()
        })

        it("should deliver a pending unlock before a fingerprint job", async () => {
            const job = await enroll("Juan")
            await db.orm.public.DeviceCommand.upsert({
                create: { deviceId: DEVICE_ID, pendingUnlockAt: new Date().toISOString() },
                update: { pendingUnlockAt: new Date().toISOString() },
            })

            expect(await pollCommand()).toEqual({ command: "UNLOCK" })
            expect(await pollCommand()).toEqual({ command: "ENROLL", jobId: job.id, slot: 1 })
        })

        it("should not deliver a job older than the TTL and mark it EXPIRED", async () => {
            const job = await seedJob({ createdAgoSeconds: Number(env.UNLOCK_COMMAND_TTL_SECONDS) + 5 })

            expect(await pollCommand()).toEqual({ command: null })
            expect((await getJob(job.id))!.status).toBe("EXPIRED")
        })

        it("should hand a job to exactly one of many concurrent polls", async () => {
            await enroll("Juan")

            const results = await Promise.all(
                Array.from({ length: 8 }, async () => (await poll(app)).json() as Promise<PollDeviceCommandResponse>),
            )

            expect(results.filter((r) => r.command === "ENROLL")).toHaveLength(1)
        })

        it("should deliver a DELETE job with the person's slot", async () => {
            const juan = await seedFingerprint("Juan", 7)
            const res = await app.request(`/fingerprints/${juan.id}`, { method: "DELETE", headers })
            const job = await res.json() as FingerprintJobDTO

            expect(await pollCommand()).toEqual({ command: "DELETE", jobId: job.id, slot: 7 })
        })
    })

    describe("POST /door/jobs/:jobId/progress", () => {
        it("should run a full enrollment: steps, then the person appears", async () => {
            const job = await enroll("Juan")
            await pollCommand()

            for (const step of ["PLACE_FINGER", "REMOVE_FINGER", "PLACE_AGAIN"]) {
                const updated = await reportOk(job.id, { step })
                expect(updated).toMatchObject({ status: "SENT", step })
            }
            expect(await getFingerprints()).toHaveLength(0)

            const done = await reportOk(job.id, { step: "SUCCEEDED" })
            expect(done.status).toBe("SUCCEEDED")

            const [fingerprint] = await getFingerprints()
            expect(fingerprint).toMatchObject({ deviceId: DEVICE_ID, slot: 1, name: "Juan" })
        })

        it("should record a failed enrollment and add nobody", async () => {
            const job = await enroll("Juan")
            await pollCommand()

            const failed = await reportOk(job.id, { step: "FAILED", error: "MISMATCH" })

            expect(failed).toMatchObject({ status: "FAILED", error: "MISMATCH" })
            expect(await getFingerprints()).toHaveLength(0)
        })

        it("should remove the person when a DELETE job succeeds", async () => {
            const juan = await seedFingerprint("Juan", 1)
            const job = await seedJob({ type: "DELETE", status: "SENT", sentAgoSeconds: 1, fingerprintId: juan.id })

            await reportOk(job.id, { step: "SUCCEEDED" })

            expect(await getFingerprints()).toHaveLength(0)
        })

        it("should keep the person when a DELETE job fails", async () => {
            const juan = await seedFingerprint("Juan", 1)
            const job = await seedJob({ type: "DELETE", status: "SENT", sentAgoSeconds: 1, fingerprintId: juan.id })

            await reportOk(job.id, { step: "FAILED", error: "DELETE_FAILED" })

            expect(await getFingerprints()).toHaveLength(1)
        })

        it("should allow a new job right after one finishes", async () => {
            const first = await enroll("Juan")
            await pollCommand()
            await reportOk(first.id, { step: "SUCCEEDED" })

            const second = await enroll("Ana")
            expect(second.slot).toBe(2)
        })

        it.each(["PENDING", "SUCCEEDED", "FAILED", "EXPIRED"] as const)(
            "should return FINGERPRINT_JOB_NOT_ACTIVE for a %s job",
            async (status) => {
                const job = await seedJob({ status })

                await expectError(await report(job.id, { step: "SUCCEEDED" }), 409, "FINGERPRINT_JOB_NOT_ACTIVE")
                expect(await getFingerprints()).toHaveLength(0)
            },
        )

        it("should reject a late report after the backend timed the job out", async () => {
            const job = await seedJob({
                status: "SENT",
                sentAgoSeconds: Number(env.FINGERPRINT_JOB_TIMEOUT_SECONDS) + 5,
            })

            await expectError(await report(job.id, { step: "SUCCEEDED" }), 409, "FINGERPRINT_JOB_NOT_ACTIVE")
            expect(await getJob(job.id)).toMatchObject({ status: "FAILED", error: "DEVICE_TIMEOUT" })
            expect(await getFingerprints()).toHaveLength(0)
        })

        it("should return FINGERPRINT_JOB_NOT_FOUND for an unknown or malformed job id", async () => {
            await expectError(await report(crypto.randomUUID(), { step: "SUCCEEDED" }), 404, "FINGERPRINT_JOB_NOT_FOUND")
            await expectError(await report("not-a-uuid", { step: "SUCCEEDED" }), 404, "FINGERPRINT_JOB_NOT_FOUND")
        })

        it.each([
            { testCase: "an unknown step", body: { step: "DANCE" } },
            { testCase: "FAILED without an error", body: { step: "FAILED" } },
            { testCase: "an error on a non-FAILED step", body: { step: "SUCCEEDED", error: "MISMATCH" } },
            { testCase: "the backend-only DEVICE_TIMEOUT error", body: { step: "FAILED", error: "DEVICE_TIMEOUT" } },
        ])("should return VALIDATION_ERROR for $testCase", async ({ body }) => {
            const job = await seedJob({ status: "SENT", sentAgoSeconds: 1 })

            await expectError(await report(job.id, body), 400, "VALIDATION_ERROR")
            expect((await getJob(job.id))!.status).toBe("SENT")
        })

        it("should return UNKNOWN_DEVICE_ID for a job reported from an unknown device", async () => {
            const job = await seedJob({ status: "SENT", sentAgoSeconds: 1 })

            await expectError(
                await reportProgress(app, job.id, { deviceId: "back_door", step: "SUCCEEDED" }),
                400,
                "UNKNOWN_DEVICE_ID",
            )
        })

        it.each([
            { testCase: "missing", apiKey: null },
            { testCase: "wrong", apiKey: "wrong-key" },
        ])("should return DEVICE_UNAUTHORIZED when the API key is $testCase", async ({ apiKey }) => {
            const job = await seedJob({ status: "SENT", sentAgoSeconds: 1 })

            await expectError(
                await reportProgress(app, job.id, { deviceId: DEVICE_ID, step: "SUCCEEDED" }, apiKey),
                401,
                "DEVICE_UNAUTHORIZED",
            )
            expect((await getJob(job.id))!.status).toBe("SENT")
        })
    })

    describe("access events", () => {
        it("should snapshot the person's name on a GRANTED scan", async () => {
            await seedFingerprint("Juan", 3)

            const event = await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 3 })

            expect(event.fingerprintName).toBe("Juan")
        })

        it("should keep the old name in history after a rename", async () => {
            const juan = await seedFingerprint("Juan", 3)
            await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 3 })

            await app.request(`/fingerprints/${juan.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify({ name: "Juan D." }),
            })
            await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 3 })

            const summary = await (await app.request("/dashboard/summary", { headers })).json() as {
                recentHistory: AccessEventDTO[]
            }
            expect(summary.recentHistory.map((e) => e.fingerprintName)).toEqual(["Juan D.", "Juan"])
        })

        it("should leave the name null for an unenrolled slot and for other outcomes", async () => {
            expect((await postAccess({ deviceId: DEVICE_ID, outcome: "GRANTED", fingerprintSlot: 9 })).fingerprintName).toBeNull()
            expect((await postAccess({ deviceId: DEVICE_ID, outcome: "DENIED" })).fingerprintName).toBeNull()
        })
    })
})
