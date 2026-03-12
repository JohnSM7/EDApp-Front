import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../store/auth'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
        path: '/my-team',
        name: 'my-team',
        component: () => import('../views/TeamView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/analyst',
        name: 'analyst',
        component: () => import('../views/AnalystView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/stats',
        name: 'stats',
        component: () => import('../views/StatsView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/ai-analysis',
        name: 'ai-analysis',
        component: () => import('../views/AiAnalysisView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/analyst/console',
        name: 'analyst-console',
        component: () => import('../views/AnalystConsoleView.vue'),
        meta: { requiresAuth: false }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
