import { createPinia } from 'pinia';
import { createApp } from 'vue';
import appRoutes from './router';
import App from './App.vue';

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(appRoutes)
app.mount('#app')
