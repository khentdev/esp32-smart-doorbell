import { randomInt } from "crypto";
const generateOtp = (length: number = 6): string =>
    Array.from({ length: length }, () => randomInt(0, 10)).join('')
export default generateOtp