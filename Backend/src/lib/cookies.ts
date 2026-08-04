import type { Context } from 'hono'
import {
    deleteCookie,
    getCookie,
    getSignedCookie,
    setCookie,
    setSignedCookie,
} from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import { env } from '../configs/env.js'
import { tokenExpiry } from './jwt/tokens.js'

const isProd = () => env.NODE_ENV === 'production'

type CreateAuthCookieOptionsParams = {
    type: "sid" | "csrfToken"
    maxAge?: number
}
function createAuthCookieOptions({ type, maxAge }: CreateAuthCookieOptionsParams): CookieOptions {
    return {
        path: "/",
        domain: isProd() && env.DOMAIN_NAME ? env.DOMAIN_NAME : undefined,
        maxAge,
        httpOnly: type === "sid",
        secure: isProd(),
        sameSite: "lax",
        prefix: isProd() ? "secure" : undefined
    }
}

type SetAuthCookieParams = {
    c: Context
    token: string
    maxAge?: number
}
export const setSessionCookie = async ({ c, token, maxAge = tokenExpiry().sessionTokenMaxAge }: SetAuthCookieParams) =>
    await setSignedCookie(c, "sid", token, env.COOKIE_SECRET, createAuthCookieOptions({ type: "sid", maxAge }))
export const setCsrfTokenCookie = ({ c, token, maxAge = tokenExpiry().csrfTokenMaxAge }: SetAuthCookieParams) =>
    setNormalCookie(c, "csrfToken", token, maxAge)

export const getSessionCookie = async (c: Context) => await getSignedCookie(c, env.COOKIE_SECRET, "sid", isProd() ? 'secure' : undefined)

export const deleteAuthCookie = (c: Context, name: "sid") =>
    deleteCookie(c, name, {
        path: "/",
        domain: isProd() && env.DOMAIN_NAME ? env.DOMAIN_NAME : undefined,
        httpOnly: name === "sid",
        secure: isProd(),
        sameSite: "lax",
        prefix: isProd() ? "secure" : undefined
    })

// Normal Cookie Generations
export const setNormalCookie = (c: Context, name: string, value: string, maxAge?: number) =>
    setCookie(c, name, value, {
        path: "/",
        domain: isProd() && env.DOMAIN_NAME ? env.DOMAIN_NAME : undefined,
        httpOnly: false,
        secure: isProd(),
        sameSite: "lax",
        maxAge,
    })

export const getNormalCookie = (c: Context, name: string) => getCookie(c, name)

export const deleteNormalCookie = (c: Context, name: string) =>
    deleteCookie(c, name, {
        path: "/",
        domain: isProd() && env.DOMAIN_NAME ? env.DOMAIN_NAME : undefined,
        httpOnly: false,
        secure: isProd(),
        sameSite: "lax",
    })

