<script setup lang="ts">
import { useAuthStore } from './store/auth'
import { LayoutDashboard, Users, Video, BarChart2, LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout">
    <nav v-if="auth.isAuthenticated" class="side-nav glass-card">
      <div class="nav-logo">
        <div class="logo-mini">ED</div>
        <span>EDApp</span>
      </div>
      
      <div class="nav-links">
        <router-link to="/" class="nav-item" active-class="active">
          <LayoutDashboard :size="20" />
          <span>Inicio</span>
        </router-link>
        
        <router-link to="/my-team" class="nav-item" active-class="active">
          <Users :size="20" />
          <span>Mi Equipo</span>
        </router-link>
        
        <router-link to="/analyst" class="nav-item" active-class="active">
          <Video :size="20" />
          <span>Analista</span>
        </router-link>
        
        <router-link to="/stats" class="nav-item" active-class="active">
          <BarChart2 :size="20" />
          <span>Estadísticas</span>
        </router-link>
      </div>

      <button @click="handleLogout" class="logout-btn">
        <LogOut :size="20" />
        <span>Cerrar Sesión</span>
      </button>
    </nav>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style>
@import './styles/base.css';

.app-layout {
  display: flex;
  min-height: 100vh;
}

.side-nav {
  width: 260px;
  margin: 20px;
  height: calc(100vh - 40px);
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 20px;
  border-radius: 24px !important;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 48px;
  font-weight: 700;
  font-size: 20px;
}

.logo-mini {
  background: var(--primary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--text-muted);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.nav-item.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.content {
  flex-grow: 1;
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease;
  width: 100%;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

@media (max-width: 768px) {
  .side-nav {
    display: none; /* Add mobile nav later */
  }
}
</style>
