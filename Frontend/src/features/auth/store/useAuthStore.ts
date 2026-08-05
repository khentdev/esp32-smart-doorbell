// Handle auth operation here and shits

import { AxiosError } from 'axios';
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';

import { authService } from '../../../api/auth/service';
import { errorHandler } from '../../../api/errors/errorHandler';
import { useToast } from '../../../shared/toast/useToast';

import type { AuthErrorCodes } from "../../../api/auth/errors";
import type { ErrorResponse } from "../../../api/errors";
import type { UserData } from '../../../api/auth/types';
export const useAuthStore = defineStore('auth', () => {

    const { toast } = useToast()

    const error = reactive({
        form: ""
    })

    const user = ref<UserData | null>(null)

    const login = async (email: string, password: string) => {
        try {
            const res = await authService.login(email, password)
            user.value = res.user
        } catch (err) {
            const { message, code, type } = errorHandler(err as AxiosError<ErrorResponse<AuthErrorCodes>>)
            if (type === "offline") toast.error("You are offline. Please check your internet connection.")
            if (type === "timeout" || type === "unreachable" || type === "server_error") error.form = message
            if (code === "AUTH_USERNAME_REQUIRED" || code === "AUTH_PASSWORD_REQUIRED") error.form = message
        }
    }

    const getSession = async () => { 
        
    }

    return {
        login,
        user
    }
})