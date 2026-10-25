import { axiosInstance } from '@/api/axios/axiosConfig'
import type { LoginRequest, LoginResponse, LogoutResponse, SessionResponse } from '@/types/api'

export const authService = {
  login: (body: LoginRequest) =>
    axiosInstance.post<LoginResponse, LoginResponse>('/auth/login', body),
  getSession: () => axiosInstance.get<SessionResponse, SessionResponse>('/session/me'),
  logout: () => axiosInstance.delete<LogoutResponse, LogoutResponse>('/session/logout'),
}
