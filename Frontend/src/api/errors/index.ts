import type { ApiErrorCode, ValidationIssue } from '@/types/api'

export type ErrorType = 'api' | 'offline' | 'timeout' | 'unreachable' | 'server_error'

export type ClientErrorCode = 'OFFLINE' | 'TIMEOUT' | 'UNREACHABLE' | 'UNKNOWN'

export type ErrorResponse = {
  code: ApiErrorCode | ClientErrorCode
  message: string
  type: ErrorType
  status?: number
  field?: string
  issues?: ValidationIssue[]
}

export type ErrorReturnType = { error: ErrorResponse }
