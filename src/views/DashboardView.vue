<script setup lang="ts">
import { useAuthStore } from '../store/auth'
import { Trophy, Users, BarChart } from 'lucide-vue-next'

const auth = useAuthStore()
</script>

<template>
  <div class="dashboard">
    <header class="page-header">
      <h1>Bienvenido, {{ auth.user?.name }}</h1>
      <p>Resumen de actividad de tu equipo para esta temporada.</p>
    </header>

    <div class="stats-grid">
      <div class="glass-card stat-card">
        <div class="stat-icon blue">
          <Trophy :size="24" />
        </div>
        <div class="stat-info">
          <h3>Partidos Jugados</h3>
          <p class="stat-value">12</p>
        </div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-icon green">
          <Users :size="24" />
        </div>
        <div class="stat-info">
          <h3>Plantilla</h3>
          <p class="stat-value">22</p>
        </div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-icon amber">
          <BarChart :size="24" />
        </div>
        <div class="stat-info">
          <h3>Análisis Completados</h3>
          <p class="stat-value">45</p>
        </div>
      </div>
    </div>

    <section class="recent-clips glass-card">
      <h2>Últimos Recortes</h2>
      <div class="empty-state">
        <p>No hay recortes recientes. Empieza a analizar un partido en el Modo Analista.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 32px;
}

h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

p {
  color: var(--text-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.stat-icon.blue { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.stat-icon.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.stat-icon.amber { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }

.stat-info h3 {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.recent-clips {
  padding: 32px;
  min-height: 200px;
}

h2 {
  font-size: 20px;
  margin-bottom: 20px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
