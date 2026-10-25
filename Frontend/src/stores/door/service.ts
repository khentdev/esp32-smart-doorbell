import { axiosInstance } from '@/api/axios/axiosConfig'
import type { ManualDoorUnlockRequest, ManualDoorUnlockResponse } from '@/types/api'

export const doorService = {
  unlock: (body: ManualDoorUnlockRequest) =>
    axiosInstance.post<ManualDoorUnlockResponse, ManualDoorUnlockResponse>('/door/unlock', body),
}
