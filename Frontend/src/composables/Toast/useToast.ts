import { readonly, ref } from 'vue'

export type ToastKind = 'granted' | 'denied' | 'admin' | 'success' | 'error' | 'info'

export type Toast = {
  id: number
  kind: ToastKind
  title: string
  message?: string
  duration: number
}

export type ToastInput = Omit<Toast, 'id' | 'duration'> & { duration?: number }

const MAX_TOASTS = 3
const DEFAULT_DURATION = 4500

const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function show(input: ToastInput) {
  // Dedup identical live toasts (e.g. repeated offline notices). Access events carry a unique
  // `message` (timestamp), so a repeated denied scan is never swallowed.
  const duplicate = toasts.value.find(
    (t) => t.kind === input.kind && t.title === input.title && t.message === input.message,
  )
  if (duplicate) return duplicate.id

  const id = nextId++
  const toast: Toast = { duration: DEFAULT_DURATION, ...input, id }
  toasts.value = [...toasts.value, toast]
  while (toasts.value.length > MAX_TOASTS) dismiss(toasts.value[0]!.id)

  if (toast.duration > 0)
    timers.set(
      id,
      setTimeout(() => dismiss(id), toast.duration),
    )
  return id
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    show,
    dismiss,
    success: (title: string, message?: string) => show({ kind: 'success', title, message }),
    error: (title: string, message?: string) => show({ kind: 'error', title, message }),
    info: (title: string, message?: string) => show({ kind: 'info', title, message }),
  }
}
