export type ToastType = "success" | "error" | "warning" | "info" | "doorbell"
export type ToastOptions = { message: string, title?: string, type: ToastType, duration?: number, dedup?: boolean }
export type Toasts = ToastOptions & { id: string }
export type PickedToastOptions = Pick<ToastOptions, "duration" | "dedup" | "title">
export type ToastFn = (message: string, opts?: PickedToastOptions) => void
export const createToastFn = <T extends ToastType, F extends (options: ToastOptions) => void>
    (type: T, Fn: F): ToastFn => (message, opts) => Fn({ message, type, ...opts })