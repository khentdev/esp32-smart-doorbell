import { pino } from "pino"
import { env } from "../configs/env.js"
import { randomUUID } from "crypto"

const isProd = env.NODE_ENV === "production"
const logger = pino({
    level: isProd ? "info" : "debug",
    transport:
        isProd ?
            undefined :
            {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    ignore: "pid,hostname",
                    translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
                }
            },
    formatters: {
        level: (label: string) => ({ level: label.toUpperCase() })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
        env: env.NODE_ENV,
        id: randomUUID()
    }
})
export default logger
