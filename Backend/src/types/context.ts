import type { TokenPayload } from "../lib/jwt/index.js"


export type AppContext<T = {}> = {
    Variables: {
        authenticatedUserTokenPayload: TokenPayload
    } & T
}