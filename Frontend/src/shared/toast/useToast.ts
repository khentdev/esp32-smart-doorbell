import { computed, nextTick, ref } from "vue";
import type { Toasts, ToastOptions } from "./index";
import { createToastFn } from "./index"

const toastList = ref<Toasts[]>([])
const toasts = computed(() => toastList.value)
const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>()

const MAX_TOAST = 3
export const baseToast = (options: ToastOptions) => {
    const shouldDedup = options.dedup === true
    const dedupKey = shouldDedup
        ? `${options.type}-${options.message}`
        : crypto.randomUUID()
    const id = `[${options.type.toUpperCase()}]-[${dedupKey}]`
    if (shouldDedup) {
        toastList.value = toastList.value.filter(t => t.id !== id)
        clearTimeout(timeoutMap.get(id))
        timeoutMap.delete(id)
    }

    if (toastList.value.length >= MAX_TOAST) {
        const toShift = toastList.value.shift()
        if (toShift) {
            clearTimeout(timeoutMap.get(toShift.id))
            timeoutMap.delete(toShift.id)
        }
    }

    const toastData: Toasts = { id, ...options }
    toastList.value.push(toastData)

    timeoutMap.set(id, setTimeout(() => {
        removeToast(id)
    }, options.duration ?? 5000))

}

const removeToast = (id: string) => {
    const hasTimeout = timeoutMap.get(id)
    if (hasTimeout) clearTimeout(hasTimeout)
    timeoutMap.delete(id)

    nextTick(() => {
        toastList.value = toastList.value.filter(t => t.id !== id)
    })

}
const toast = {
    success: createToastFn("success", baseToast),
    error: createToastFn("error", baseToast),
    warning: createToastFn("warning", baseToast),
    info: createToastFn("info", baseToast),
    doorway: createToastFn("doorbell", baseToast),
}
export const useToast = () => ({
    toasts,
    toast,
    removeToast
})