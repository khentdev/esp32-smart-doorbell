import type { FingerprintJobDTO, FingerprintJobError, FingerprintJobStep } from '@/types/api'

/** Same prompts the OLED shows at the door, in order. */
export const ENROLL_STEPS: { step: FingerprintJobStep; label: string }[] = [
  { step: 'PLACE_FINGER', label: 'Place finger on the sensor' },
  { step: 'REMOVE_FINGER', label: 'Remove finger' },
  { step: 'PLACE_AGAIN', label: 'Place the same finger again' },
]

export const JOB_ERROR_MESSAGES: Record<FingerprintJobError, string> = {
  MISMATCH: "The two scans didn't match.",
  TIMEOUT: 'No finger was placed in time.',
  BAD_IMAGE: "The sensor couldn't read the finger.",
  STORE_FAILED: "The sensor couldn't save the fingerprint.",
  DELETE_FAILED: "The sensor couldn't remove the fingerprint.",
  DEVICE_TIMEOUT: 'The door stopped responding.',
}

export const EXPIRED_MESSAGE = 'The door is offline. Check its power and WiFi, then try again.'

export const isActiveJob = (job: FingerprintJobDTO) =>
  job.status === 'PENDING' || job.status === 'SENT'

/** Why a finished job didn't succeed, or null if it did. */
export function jobFailureMessage(job: FingerprintJobDTO) {
  if (job.status === 'EXPIRED') return EXPIRED_MESSAGE
  if (job.status === 'FAILED')
    return job.error ? JOB_ERROR_MESSAGES[job.error] : 'Something went wrong.'
  return null
}
