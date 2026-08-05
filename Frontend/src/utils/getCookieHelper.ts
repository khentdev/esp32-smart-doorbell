export const getCookie = (cookieName: string): string | undefined => {
    if (!cookieName)
        throw new Error("Cookie name cannot be empty")

    const cookies = document.cookie.trim()
    if (!cookies)
        return undefined

    const cookiesObject = cookies.split("; ").reduce((acc, cookie) => {
        const separatorIndex = cookie.indexOf("=")
        if (separatorIndex === -1)
            return acc

        const key = cookie.slice(0, separatorIndex)
        const value = cookie.slice(separatorIndex + 1)
        acc[key] = value
        return acc
    }, {} as Record<string, string>)

    return cookiesObject[cookieName]
}