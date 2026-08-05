import { getTypedResponse } from '../../shared/types';
import { axiosInstance } from '../axios/axiosConfig';

import type { LoginResponse } from "./types"
// Apply this pattern to other feature services and shits
export const authService = {
    login: async (email: string, password: string) => {
        const response = await axiosInstance.post('/auth/login', { email, password })
        return getTypedResponse<LoginResponse>(response)
    },
    getSession: async () => {

    }
}