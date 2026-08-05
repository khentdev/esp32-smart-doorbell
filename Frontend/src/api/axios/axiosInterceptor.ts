import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { getFingerprint } from '../../plugins/getFingerprint';
import { getCookie } from '../../utils/getCookieHelper';

const onRequest = async (
    config: InternalAxiosRequestConfig
) => {
    // Session Cookie (ID) is http-only; already included in the request
    config.headers["X-Fingerprint"] = await getFingerprint()
    const csrfTokenName = "csrfToken"
    config.headers["X-CSRF-Token"] = getCookie(csrfTokenName)
    return config
};
const onRequestError = (error: AxiosError) =>
    Promise.reject(error)

const onResponse = (response: AxiosResponse) =>
    response.data

export const setupInterceptors = (axiosInstance: AxiosInstance) => {
    axiosInstance.interceptors.request.use(onRequest, onRequestError)
    axiosInstance.interceptors.response.use(onResponse)
}