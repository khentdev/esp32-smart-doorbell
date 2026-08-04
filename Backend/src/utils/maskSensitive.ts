import maskData from 'maskdata';

import { env } from '../configs/env.js';

import type { EmailMask2Options } from "maskdata"
const isProduction = () => env.NODE_ENV === "production"

const maskInProduction = (value: string, maskFn: (v: string) => string): string =>
    isProduction() ? maskFn(value) : value

const emailMaskOptions: EmailMask2Options = {
    maskWith: "*",
    unmaskedStartCharactersBeforeAt: 2,
    unmaskedEndCharactersAfterAt: 257,
    maskAtTheRate: false,
}
export const maskEmailForLog = (email: string) =>
    maskInProduction(email, (v) => maskData.maskEmail2(v, emailMaskOptions))
