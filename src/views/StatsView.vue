<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { BarChart as BarIcon, TrendingUp, Target, Shield, Users } from 'lucide-vue-next'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const goalsChartRef = ref<HTMLCanvasElement | null>(null)
const performanceChartRef = ref<HTMLCanvasElement | null>(null)

interface TeamStat {
  label: string;
  value: string;
  trend: number;
  icon: any;
  color: string;
}

const stats = ref<TeamStat[]>([
  { label: 'Goles Favor', value: '28', trend: 15, icon: Target, color: '#3b82f6' },
  { label: 'Goles Contra', value: '12', trend: -5, icon: Shield, color: '#10b981' },
  { label: 'Posesión Media', value: '58%', trend: 2, icon: TrendingUp, color: '#f59e0b' },
  { label: 'Asistencias', value: '21', trend: 10, icon: Users, color: '#8b5cf6' }
])

onMounted(() => {
  // Render Goals Chart
  if (goalsChartRef.value) {
    new Chart(goalsChartRef.value, {
      type: 'bar',
      data: {
        labels: ['Jor 1', 'Jor 2', 'Jor 3', 'Jor 4', 'Jor 5', 'Jor 6'],
        datasets: [{
          label: 'Goles a Favor',
          data: [2, 1, 3, 0, 4, 2],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }, {
          label: 'Goles en Contra',
          data: [1, 2, 0, 1, 1, 0],
          backgroundColor: '#ef4444',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e2e8f0' } }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    })
  }

  // Render Performance Radar Chart
  if (performanceChartRef.value) {
    new Chart(performanceChartRef.value, {
      type: 'radar',
      data: {
        labels: ['Ataque', 'Defensa', 'Posesión', 'Transiciones', 'Balón Parado', 'Intensidad'],
        datasets: [{
          label: 'Métrica del Equipo',
          data: [85, 70, 90, 75, 60, 80],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#e2e8f0', font: { size: 12 } },
            ticks: { display: false },
            max: 100,
            min: 0
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    })
  }
})
</script>

<template>
  <div class="stats-view">
    <header class="page-header">
      <div class="header-main">
        <h1>Datos Colectivos</h1>
        <div class="actions">
          <button class="studio-btn-secondary">
            <BarIcon :size="18" />
            Exportar Informe PDF
          </button>
        </div>
      </div>
      <p>Visualiza el rendimiento y métricas globales de tu equipo mediante analítica avanzada.</p>
    </header>

    <!-- Top KPI Highlights -->
    <div class="kpi-grid">
      <div v-for="(stat, index) in stats" :key="index" class="kpi-card glass-card">
        <div class="kpi-icon-container" :style="{ background: `${stat.color}22`, color: stat.color }">
          <component :is="stat.icon" :size="24" />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{{ stat.label }}</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ stat.value }}</span>
            <span class="kpi-trend" :class="stat.trend >= 0 ? 'positive' : 'negative'">
              {{ stat.trend >= 0 ? '+' : '' }}{{ stat.trend }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid">
      <div class="chart-card glass-card">
        <h3 class="chart-title">Evolución de Goles</h3>
        <div class="chart-container">
          <canvas ref="goalsChartRef"></canvas>
        </div>
      </div>
      
      <div class="chart-card glass-card">
        <h3 class="chart-title">Radar de Rendimiento Táctico</h3>
        <div class="chart-container">
          <canvas ref="performanceChartRef"></canvas>
        </div>
      </div>
    </div>

    <!-- Data Table / Advanced Insights Placeholder -->
    <div class="insights-section glass-card">
      <h3 class="chart-title">Insights Generados por IA</h3>
      <div class="insight-list">
         <div class="insight-item">
           <div class="insight-bullet positive"></div>
           <p><strong>Fuerte en ataque:</strong> El equipo tiene un excelente promedio de conversión en la segunda mitad de los partidos (75%).</p>
         </div>
         <div class="insight-item">
           <div class="insight-bullet negative"></div>
           <p><strong>Punto de mejora:</strong> Fragilidad defensiva detectada en transiciones rápidas del rival por la banda izquierda.</p>
         </div>
         <div class="insight-item">
           <div class="insight-bullet neutral"></div>
           <p><strong>Observación:</strong> La posesión media es alta, pero el ritmo de balón circular debería aumentar (+2 pases/min) para desorganizar defensas cerradas.</p>
         </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 32px;
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.studio-btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 18px;
  border-radius: 8px;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.studio-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.kpi-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: transform 0.2s;
}

.kpi-card:hover {
  transform: translateY(-5px);
  border-color: rgba(59, 130, 246, 0.3);
}

.kpi-icon-container {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 0 10px rgba(255,255,255,0.05);
}

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: white;
}

.kpi-trend {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 20px;
}

.kpi-trend.positive {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.kpi-trend.negative {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.chart-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.chart-title {
  font-size: 18px;
  margin: 0 0 20px 0;
  font-weight: 600;
  color: white;
}

.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}

/* Insights */
.insights-section {
  padding: 24px;
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: rgba(0,0,0,0.2);
  padding: 16px;
  border-radius: 8px;
}

.insight-bullet {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.insight-bullet.positive { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); }
.insight-bullet.negative { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
.insight-bullet.neutral { background: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }

.insight-item p {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: #cbd5e1;
}

.insight-item strong {
  color: white;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
