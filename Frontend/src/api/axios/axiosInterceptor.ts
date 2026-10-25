import axios from 'axios'
import { axiosInstance } from './axiosConfig'
import { errorHandler } from '@/api/errors/errorHandler'
import { getFingerprint, resetFingerprint } from '@/utils/getFingerprint'
import { getCsrfToken } from '@/utils/getCookieHelper'
import { SESSION_ENDED_CODES } from '@/types/api'

type SessionEndedHandler = () => void
let onSessionEnded: SessionEndedHandler | null = null

/** Registered once from main.ts so the api layer needn't import stores or the router. */
export function setSessionEndedHandler(handler: SessionEndedHandler) {
  onSessionEnded = handler
}

axiosInstance.interceptors.request.use(async (config) => {
  config.headers.set('X-Fingerprint', await getFingerprint())
  const csrf = getCsrfToken()
  if (csrf) config.headers.set('X-CSRF-Token', csrf)
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isAxiosError(error)) {
      const { code, status } = errorHandler(error)
      if (code === 'INVALID_DEVICE_ID') {
        resetFingerprint()
        onSessionEnded?.()
      } else if (status === 401 && (SESSION_ENDED_CODES as string[]).includes(code)) {
        onSessionEnded?.()
      }
    }
    return Promise.reject(error)
  },
)
