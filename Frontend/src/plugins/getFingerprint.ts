import { getThumbmark } from '@thumbmarkjs/thumbmarkjs';

let fingerprintPromise: Promise<string> | null = null

export const getFingerprint = (): Promise<string> => {
    // most stable I have built so far
    if (!fingerprintPromise) {
        fingerprintPromise = (async () => {
            const result = await getThumbmark({
                exclude: [
                    'audio',
                    'canvas',
                    'webgl',
                    'system.browser.version',
                    'screen',
                    'permissions',
                    'plugins',
                    'locales.timezone',
                    'system.useragent',
                    'system.browser',
                    'system.mobile',
                    'system.cookieEnabled',
                    'system.applePayVersion',
                    'math',
                    'system.hardwareConcurrency',
                    'hardware.deviceMemory',
                    'hardware.jsHeapSizeLimit',
                ],
                logging: false,
                cache_api_call: true,
                performance: true,
            })
            return JSON.stringify(result.components)
        })()
    }
    return fingerprintPromise
}