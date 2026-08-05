import axios, { type AxiosInstance } from 'axios'
import { LoadEnv } from '../../config/loadEnv'
import { setupInterceptors } from './axiosInterceptor'

const isProd = import.meta.env.PROD
const API_URL_KEY = isProd ? "VITE_PROD_API_URL" : "VITE_DEV_API_URL"

export const axiosInstance: AxiosInstance = axios.create({
    baseURL: isProd ? `https://${LoadEnv(API_URL_KEY)}` : LoadEnv(API_URL_KEY),
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
})

setupInterceptors(axiosInstance)