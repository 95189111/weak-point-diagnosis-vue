import { defineStore } from 'pinia'
import api, { setToken } from '@/api'

const TOKEN_KEY = 'APP_TOKEN'
const USER_KEY = 'APP_USER'

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: readJson(USER_KEY),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    roleName: (s) => s.user?.role || '-',
  },
  actions: {
    async login(account, password) {
      const data = await api.post('/api/accounts/login', { account, password })
      this.token = data.token
      this.user = data.user
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setToken(data.token)
      return data
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken('')
    },
    restore() {
      setToken(this.token)
    },
  },
})
