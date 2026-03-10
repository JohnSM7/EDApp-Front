<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { LogIn, ShieldCheck } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const success = await auth.login(username.value, password.value)
    if (success) {
      router.push('/')
    } else {
      error.value = 'Credenciales inválidas'
    }
  } catch (err) {
    error.value = 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="glass-card login-card">
      <div class="logo-section">
        <div class="icon-circle">
          <ShieldCheck :size="32" color="white" />
        </div>
        <h1>EDApp Analysis</h1>
        <p>Premium Football Intelligence</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Usuario</label>
          <input 
            v-model="username" 
            type="text" 
            class="input-field" 
            placeholder="ej. analista01" 
            required
          >
        </div>
        
        <div class="form-group">
          <label>Contraseña</label>
          <input 
            v-model="password" 
            type="password" 
            class="input-field" 
            placeholder="••••••••" 
            required
          >
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn-primary login-btn" :disabled="loading">
          <LogIn :size="20" />
          {{ loading ? 'Iniciando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  animation: fadeIn 0.8s ease-out;
}

.logo-section {
  text-align: center;
  margin-bottom: 32px;
}

.icon-circle {
  background: var(--primary);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 16px;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

h1 {
  font-size: 24px;
  margin-bottom: 4px;
}

p {
  color: var(--text-muted);
  font-size: 14px;
}

.login-form {
  display: flex;
  vertical-align: top;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}

.login-btn {
  width: 100%;
  justify-content: center;
  margin-top: 12px;
  height: 48px;
}

.error-msg {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
