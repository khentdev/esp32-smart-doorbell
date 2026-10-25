import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService } from './service'
import { errorHandler } from '@/api/errors/errorHandler'
import type { UserDTO } from '@/types/api'
import type { LoginFormErrors, SessionState } from '@/types/auth/userAuth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDTO | null>(null)
  const sessionState = ref<SessionState>('idle')

  const loadingStates = reactive({ login: false, logout: false })
  const formErrors = reactive<LoginFormErrors>({})

  const isAuthed = computed(() => user.value !== null)

  function clearFormErrors() {
    formErrors.username = formErrors.password = formErrors.general = undefined
  }

  /** Clears local auth state only; the server session is left to expire or be logged out. */
  function clear() {
    user.value = null
  }

  /** Restores the session on app load. A 4xx just means "guest"; network/server failures set `error`. */
  async function checkAuth() {
    sessionState.value = 'loading'
    try {
      user.value = (await authService.getSession()).user
      sessionState.value = 'ready'
    } catch (err) {
      const { type } = errorHandler(err)
      user.value = null
      sessionState.value = type === 'api' ? 'ready' : 'error'
    }
  }

  async function login(username: string, password: string) {
    clearFormErrors()
    if (!username.trim()) formErrors.username = 'Username is required'
    if (!password.trim()) formErrors.password = 'Password is required'
    if (formErrors.username || formErrors.password) return false

    loadingStates.login = true
    try {
      user.value = (await authService.login({ username, password })).user
      sessionState.value = 'ready'
      return true
    } catch (err) {
      const { code, message, issues } = errorHandler(err)
      switch (code) {
        case 'INVALID_CREDENTIALS':
          formErrors.general = 'Invalid username or password'
          break
        case 'INVALID_USERNAME':
          formErrors.username = message
          break
        case 'INVALID_PASSWORD':
          formErrors.password = message
          break
        case 'VALIDATION_ERROR':
          for (const issue of issues ?? []) {
            if (issue.path === 'username') formErrors.username = issue.message
            else if (issue.path === 'password') formErrors.password = issue.message
            else formErrors.general = issue.message
          }
          if (!formErrors.username && !formErrors.password && !formErrors.general) {
            formErrors.general = message
          }
          break
        default:
          formErrors.general = message
      }
      return false
    } finally {
      loadingStates.login = false
    }
  }

  /** Always ends logged-out locally, even when the call fails (e.g. `401 TOKEN_EXPIRED`). */
  async function logout() {
    loadingStates.logout = true
    try {
      await authService.logout()
    } catch {
      /* clear local state either way */
    } finally {
      clear()
      loadingStates.logout = false
    }
  }

  return {
    user,
    sessionState,
    isAuthed,
    loadingStates,
    formErrors,
    clearFormErrors,
    clear,
    checkAuth,
    login,
    logout,
  }
})
