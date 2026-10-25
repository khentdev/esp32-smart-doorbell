import type { IsoDateString } from '@/types/api'

const absolute = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const absoluteThisYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

/** Absolute datetime in the viewer's local timezone; the year is dropped for the current year. */
export function formatDateTime(iso: IsoDateString) {
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return (sameYear ? absoluteThisYear : absolute).format(date)
}

/** "Just now", "5 minutes ago", ... relative to `now` (ms). */
export function formatRelative(iso: IsoDateString, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (seconds < 45) return 'Just now'
  const units: [number, string][] = [
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ]
  for (const [size, label] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size)
      return `${n} ${label}${n === 1 ? '' : 's'} ago`
    }
  }
  return '1 minute ago'
}
