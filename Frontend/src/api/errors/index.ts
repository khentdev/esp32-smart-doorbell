import { AxiosError } from "axios"

export type ErrorResponse<C extends string = string> = {
    error: {
        message: string,
        code: C,
        field: string,
        data?: Record<string, unknown>
    }
}
export type ErrorReturnType<C extends string = string> = {
    retryable: boolean,
    logout: boolean,
    message: string,
    type: "timeout" | "unreachable" | "server_error" | "offline" | ""
    code?: C,
    data?: Record<string, unknown>,
    field?: string
    error: AxiosError<ErrorResponse<C>>
}