import { axiosInstance } from '@/api/axios/axiosConfig'
import type {
  DeleteFingerprintResponse,
  DeviceId,
  EnrollFingerprintRequest,
  EnrollFingerprintResponse,
  ListFingerprintsResponse,
  RenameFingerprintRequest,
  RenameFingerprintResponse,
} from '@/types/api'

export const fingerprintService = {
  list: (deviceId: DeviceId) =>
    axiosInstance.get<ListFingerprintsResponse, ListFingerprintsResponse>('/fingerprints', {
      params: { deviceId },
    }),
  enroll: (body: EnrollFingerprintRequest) =>
    axiosInstance.post<EnrollFingerprintResponse, EnrollFingerprintResponse>('/fingerprints', body),
  rename: (id: string, body: RenameFingerprintRequest) =>
    axiosInstance.patch<RenameFingerprintResponse, RenameFingerprintResponse>(
      `/fingerprints/${id}`,
      body,
    ),
  remove: (id: string) =>
    axiosInstance.delete<DeleteFingerprintResponse, DeleteFingerprintResponse>(
      `/fingerprints/${id}`,
    ),
}
