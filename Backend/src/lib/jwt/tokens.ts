import { sign, verify } from 'hono/jwt';
import {
    JwtAlgorithmNotImplemented, JwtTokenExpired, JwtTokenInvalid, JwtTokenIssuedAt,
    JwtTokenNotBefore, JwtTokenSignatureMismatched
} from 'hono/utils/jwt/types';
import { randomUUID } from 'node:crypto';

import { env } from '../../configs/env.js';
import loadEnv from '../../configs/loadEnv.js';
import { AppError } from '../../errors/appError.js';
import { type ErrorCodes, FEATURE_ERROR_CODES, } from '../../errors/index.js';

import type { JwtErrorConstructor, TokenPayload, TokenPayloadParameter } from "./index.js";

export function tokenExpiry() {
    const now = Math.floor(Date.now() / 1000);
    const sessionTokenDuration = parseInt(loadEnv("JWT_REFRESH_TOKEN_EXPIRES_IN", "2592000"), 10);

    return {
        sessionTokenExpiry: now + sessionTokenDuration,
        sessionTokenMaxAge: sessionTokenDuration,
        csrfTokenMaxAge: sessionTokenDuration,
    }
}

export async function generateSessionToken(payload: TokenPayloadParameter) {
    const { sessionTokenExpiry } = tokenExpiry()
    const now = Math.floor(Date.now() / 1000)
    return sign({
        ...payload,
        iat: now,
        exp: sessionTokenExpiry,
        iss: env.JWT_ISSUER,
        nonce: randomUUID().slice(0, 8)
    }, env.JWT_SECRET, "HS512")
}

export async function generateSessionTokens(payload: TokenPayloadParameter) {
    const { sessionTokenExpiry } = tokenExpiry()
    const sessionToken = await generateSessionToken(payload)
    const csrfToken = randomUUID()
    return { sessionToken, csrfToken, sessionTokenExpiry }
}

export async function verifyTokenOrThrow(token: string) {
    try {
        const payload = await verify(token, env.JWT_SECRET, 'HS512') as TokenPayload;
        if (payload.iss !== env.JWT_ISSUER) throw new AppError(FEATURE_ERROR_CODES.TOKEN_INVALID);
        return payload
    } catch (err) {
        if (err instanceof Error) throw mapTokenError(err);
        throw new AppError(FEATURE_ERROR_CODES.TOKEN_INVALID);
    }
};

const errMap = new Map<JwtErrorConstructor, ErrorCodes>([
    [JwtAlgorithmNotImplemented, "TOKEN_INVALID"],
    [JwtTokenInvalid, "TOKEN_INVALID"],
    [JwtTokenSignatureMismatched, "TOKEN_INVALID"],
    [JwtTokenNotBefore, "TOKEN_INVALID"],
    [JwtTokenIssuedAt, "TOKEN_INVALID"],
    [JwtTokenExpired, "TOKEN_EXPIRED"],
]);

const mapTokenError = (err: Error) => {
    const code = errMap.get(err.constructor as JwtErrorConstructor);
    if (code) return new AppError(code);
    return new AppError(FEATURE_ERROR_CODES.TOKEN_INVALID);
};
