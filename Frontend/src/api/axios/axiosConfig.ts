import axios from 'axios'
import { LoadEnv } from '@/config/loadEnv'

export const API_URL = LoadEnv('VITE_API_URL')

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
})
