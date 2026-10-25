/** Reads a non-HttpOnly cookie. Re-read on every call: `csrfToken` rotates with the session. */
export function getCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
  }
  return null
}

export const getCsrfToken = () => getCookie('csrfToken')
