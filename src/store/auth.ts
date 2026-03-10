import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ name: string; role: string } | null>(null)
  const isAuthenticated = ref(false)

  const login = async (username: string, password: string) => {
    // Mock login logic
    if (username && password) {
      user.value = { name: username, role: 'admin' }
      isAuthenticated.value = true
      return true
    }
    return false
  }

  const logout = () => {
    user.value = null
    isAuthenticated.value = false
  }

  return { user, isAuthenticated, login, logout }
})
