import type { AxiosError } from "axios";
import type { ErrorResponse, ErrorReturnType } from "./index";

export const INFRA_ERROR_SERVER_UNREACHABLE = 'INFRA_ERROR_SERVER_UNREACHABLE'
export const INFRA_ERROR_SERVER_ERROR = 'INFRA_ERROR_SERVER_ERROR'
export const INFRA_ERROR_TIMEOUT = 'INFRA_ERROR_TIMEOUT'
export const INFRA_ERROR_OFFLINE = 'INFRA_ERROR_OFFLINE'

export type InfraErrorType = {
    type:
    | typeof INFRA_ERROR_SERVER_UNREACHABLE
    | typeof INFRA_ERROR_SERVER_ERROR
    | typeof INFRA_ERROR_TIMEOUT
    | typeof INFRA_ERROR_OFFLINE
    message: string
}
export const INFRA_MESSAGES = {
    [INFRA_ERROR_OFFLINE]: "You're offline. Check your connection.",
    [INFRA_ERROR_SERVER_UNREACHABLE]: "Can't reach the server. Try again in a moment.",
    [INFRA_ERROR_SERVER_ERROR]: "Something went wrong on our end. We're on it.",
    [INFRA_ERROR_TIMEOUT]: "Request timed out. Try again.",
} as const

export const getInfraErrorMessage = (type: InfraErrorType['type']): string => {
    return INFRA_MESSAGES[type] ?? "Something went wrong. Try again."
}
// Use this function to handle errors from the API e.g. catch blocks and use the returned objects for error logging and UI feedback (Yes gamitin mo to mapapadali buhay mo)
export const errorHandler = <C extends string>(err: AxiosError<ErrorResponse<C>>): ErrorReturnType<C> => {

    if (err.code === "ERR_CANCELED")
        return { retryable: false, message: "Request was canceled", logout: false, type: "", error: err }

    if (err?.code === "ECONNABORTED" || err.response?.status === 408)
        return { retryable: true, message: "Request timeout. Please try again.", logout: false, type: "timeout", error: err }

    if (!err.response || err.code === "ERR_NETWORK") {
        const msg = !navigator.onLine ? getInfraErrorMessage("INFRA_ERROR_OFFLINE") : getInfraErrorMessage("INFRA_ERROR_SERVER_UNREACHABLE")
        return {
            type: !navigator.onLine ? 'offline' : 'unreachable',
            retryable: true,
            logout: false,
            message: msg,
            error: err
        }
    }
    if (err.response.data.error.code === "SERVER_ERROR" || !err.response.data.error.code || (err.response.status ?? 0) > 500) {
        const msg = getInfraErrorMessage("INFRA_ERROR_SERVER_ERROR")
        return { retryable: true, logout: false, message: msg, type: "server_error", error: err };
    }

    const { code, field, message, data } = err.response.data.error

    const fallbackMsg = getInfraErrorMessage("INFRA_ERROR_SERVER_ERROR")
    return { retryable: true, logout: false, message: message || fallbackMsg, code, type: "", data: data ?? {}, field, error: err }
}