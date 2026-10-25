import axios from 'axios'
import type { ApiError } from '@/types/api'
import type { ErrorResponse } from '.'

const isApiError = (data: unknown): data is ApiError =>
  typeof data === 'object' && data !== null && 'error' in data

/** Normalizes anything thrown by axios into one `ErrorResponse`. Switch on `code`, never `message`. */
export function errorHandler(err: unknown): ErrorResponse {
  if (!axios.isAxiosError(err)) {
    return { code: 'UNKNOWN', message: 'Something went wrong.', type: 'server_error' }
  }

  if (err.response) {
    const { status, data } = err.response
    if (isApiError(data)) {
      const { code, message, field, issues } = data.error
      return {
        code,
        message,
        field,
        issues,
        status,
        type: status >= 500 ? 'server_error' : 'api',
      }
    }
    return { code: 'UNKNOWN', message: 'Unexpected server response.', status, type: 'server_error' }
  }

  if (!navigator.onLine) {
    return { code: 'OFFLINE', message: "You're offline.", type: 'offline' }
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return { code: 'TIMEOUT', message: 'The request timed out.', type: 'timeout' }
  }
  return { code: 'UNREACHABLE', message: "Can't reach the server.", type: 'unreachable' }
}
