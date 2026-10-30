import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { fingerprintService } from './service'
import { errorHandler } from '@/api/errors/errorHandler'
import type { ErrorResponse } from '@/api/errors'
import { useToast } from '@/composables/Toast'
import { isActiveJob, jobFailureMessage } from '@/utils/fingerprintJob'
import type {
  DeviceId,
  FingerprintDTO,
  FingerprintJobDTO,
  FingerprintJobEventDTO,
} from '@/types/api'

const DEVICE_ID: DeviceId = 'front_gate'

export const useFingerprintStore = defineStore('fingerprints', () => {
  const toast = useToast()

  const fingerprints = ref<FingerprintDTO[]>([])
  /** The enroll/delete currently waiting for or running on the door. */
  const activeJob = ref<FingerprintJobDTO | null>(null)
  /** The most recent enroll that finished, kept so the form can show its result. */
  const lastEnroll = ref<FingerprintJobDTO | null>(null)
  const hasLoaded = ref(false)

  const loadingStates = reactive({
    list: false,
    enroll: false,
    rename: null as string | null, // id being renamed
    remove: null as string | null, // id being removed
  })
  const errorStates = reactive<{ list: ErrorResponse | null }>({ list: null })

  /** `silent` skips the skeleton (used for SSE reconnect catch-up). */
  async function fetch({ silent = false } = {}) {
    if (!silent) loadingStates.list = true
    errorStates.list = null
    try {
      const result = await fingerprintService.list(DEVICE_ID)
      fingerprints.value = result.fingerprints
      activeJob.value = result.activeJob
      hasLoaded.value = true
    } catch (err) {
      if (!silent || !hasLoaded.value) errorStates.list = errorHandler(err)
    } finally {
      loadingStates.list = false
    }
  }

  /** Shows a toast for anything but a 401 (the axios interceptor already routes that to Login). */
  function toastError(title: string, err: ErrorResponse) {
    if (err.status !== 401) toast.error(title, err.message)
  }

  /** Starts an enrollment. Returns an error message for the name field, or null. */
  async function enroll(name: string): Promise<string | null> {
    if (loadingStates.enroll) return null
    loadingStates.enroll = true
    try {
      activeJob.value = await fingerprintService.enroll({ deviceId: DEVICE_ID, name })
      lastEnroll.value = null
      return null
    } catch (err) {
      const error = errorHandler(err)
      if (error.code === 'FINGERPRINT_NAME_TAKEN' || error.code === 'VALIDATION_ERROR') {
        return error.code === 'VALIDATION_ERROR' ? 'Use 1–40 characters.' : error.message
      }
      toastError("Couldn't start enrollment", error)
      if (error.code === 'FINGERPRINT_JOB_IN_PROGRESS') void fetch({ silent: true })
      return null
    } finally {
      loadingStates.enroll = false
    }
  }

  /** Renames a person. Returns an error message for the field, or null on success. */
  async function rename(id: string, name: string): Promise<string | null> {
    loadingStates.rename = id
    try {
      const updated = await fingerprintService.rename(id, { name })
      fingerprints.value = fingerprints.value.map((f) => (f.id === id ? updated : f))
      return null
    } catch (err) {
      const error = errorHandler(err)
      if (error.code === 'FINGERPRINT_NAME_TAKEN') return error.message
      if (error.code === 'VALIDATION_ERROR') return 'Use 1–40 characters.'
      toastError("Couldn't rename", error)
      if (error.code === 'FINGERPRINT_NOT_FOUND') void fetch({ silent: true })
      return null
    } finally {
      loadingStates.rename = null
    }
  }

  async function remove(id: string) {
    loadingStates.remove = id
    try {
      activeJob.value = await fingerprintService.remove(id)
    } catch (err) {
      const error = errorHandler(err)
      toastError("Couldn't remove fingerprint", error)
      if (error.code === 'FINGERPRINT_NOT_FOUND' || error.code === 'FINGERPRINT_JOB_IN_PROGRESS') {
        void fetch({ silent: true })
      }
    } finally {
      loadingStates.remove = null
    }
  }

  function clearLastEnroll() {
    lastEnroll.value = null
  }

  /** Applies one `fingerprint` SSE event: progress, or the job's final result. */
  function applyJobEvent({ job, fingerprint }: FingerprintJobEventDTO) {
    if (job.deviceId !== DEVICE_ID) return

    if (isActiveJob(job)) {
      activeJob.value = job
      if (job.type === 'ENROLL') lastEnroll.value = null
      return
    }

    // Finished. Ignore stale events for a job that is no longer the one we track.
    if (activeJob.value && activeJob.value.id !== job.id) return
    activeJob.value = null

    const failure = jobFailureMessage(job)
    if (job.type === 'ENROLL') {
      lastEnroll.value = job
      if (fingerprint && !fingerprints.value.some((f) => f.id === fingerprint.id)) {
        fingerprints.value = [...fingerprints.value, fingerprint]
      }
      if (failure) toast.error(`Couldn't enroll ${job.name}`, failure)
      else toast.success(`${job.name} enrolled`, 'They can now open the door.')
    } else {
      if (!failure)
        fingerprints.value = fingerprints.value.filter((f) => f.id !== job.fingerprintId)
      if (failure) toast.error(`Couldn't remove ${job.name}`, failure)
      else toast.success(`${job.name} removed`, 'Their fingerprint was wiped from the sensor.')
    }
  }

  function reset() {
    fingerprints.value = []
    activeJob.value = null
    lastEnroll.value = null
    hasLoaded.value = false
    errorStates.list = null
  }

  return {
    fingerprints,
    activeJob,
    lastEnroll,
    hasLoaded,
    loadingStates,
    errorStates,
    fetch,
    enroll,
    rename,
    remove,
    clearLastEnroll,
    applyJobEvent,
    reset,
  }
})
