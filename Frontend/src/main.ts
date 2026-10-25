import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setSessionEndedHandler } from '@/api/axios/axiosInterceptor'
import { useAuthStore } from '@/stores/auth/authStore'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'
import './style.css'

const app = createApp(App)
app.use(createPinia())

// Any 401 "session ended" (or bad fingerprint) from the API sends the user back to Login.
setSessionEndedHandler(() => {
  useAuthStore().clear()
  useDashboardStore().reset()
  if (router.currentRoute.value.name !== 'login') void router.replace({ name: 'login' })
})

app.use(router)
app.mount('#app')
