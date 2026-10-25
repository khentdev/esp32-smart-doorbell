import { axiosInstance } from '@/api/axios/axiosConfig'
import type { DashboardSummaryResponse } from '@/types/api'

export const dashboardService = {
  getSummary: () =>
    axiosInstance.get<DashboardSummaryResponse, DashboardSummaryResponse>('/dashboard/summary'),
}
