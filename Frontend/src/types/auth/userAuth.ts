export type SessionState = 'idle' | 'loading' | 'ready' | 'error'

export type LoginFormErrors = {
  username?: string
  password?: string
  general?: string
}
