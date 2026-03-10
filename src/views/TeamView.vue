<script setup lang="ts">
import { ref, computed } from 'vue'
import { FileUp, Search, Download, User, Activity, Target, Shield } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

interface Player {
  id: number;
  nombre: string;
  posicion: string;
  edad: number;
  dorsal: number;
  goles: number;
  asistencias: number;
  partidos: number;
  foto?: string;
}

const players = ref<Player[]>([])
const loading = ref(false)
const searchQuery = ref('')

const filteredPlayers = computed(() => {
  if (!searchQuery.value) return players.value
  return players.value.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    p.posicion.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const downloadTemplate = () => {
  const template = [
    { Nombre: 'Lionel Messi', Posicion: 'Delantero', Edad: 36, Dorsal: 10, Goles: 5, Asistencias: 3, Partidos: 10 },
    { Nombre: 'Luka Modric', Posicion: 'Centrocampista', Edad: 38, Dorsal: 10, Goles: 1, Asistencias: 4, Partidos: 12 },
    { Nombre: 'Virgil van Dijk', Posicion: 'Defensa', Edad: 32, Dorsal: 4, Goles: 0, Asistencias: 0, Partidos: 11 }
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla Equipo")
  XLSX.writeFile(wb, "plantilla_equipo_edapp.xlsx")
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  loading.value = true
  const reader = new FileReader()
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const json: any[] = XLSX.utils.sheet_to_json(worksheet)
      
      players.value = json.map((p, index) => ({
        id: index + 1,
        nombre: p.Nombre || p.nombre || 'Jugador',
        posicion: p.Posicion || p.posicion || 'N/A',
        edad: p.Edad || p.edad || 0,
        dorsal: p.Dorsal || p.dorsal || 0,
        goles: p.Goles || p.goles || 0,
        asistencias: p.Asistencias || p.asistencias || 0,
        partidos: p.Partidos || p.partidos || 0,
        foto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.Nombre || index}&backgroundColor=transparent`
      }))
    } catch (err) {
      console.error('Error parsing excel:', err)
      alert('Error al leer el archivo. Asegúrate de usar el formato correcto.')
    } finally {
      loading.value = false
    }
  }

  reader.readAsArrayBuffer(file)
}

const getPositionColor = (pos: string) => {
  const p = pos.toLowerCase()
  if (p.includes('del')) return '#f87171'
  if (p.includes('cen') || p.includes('med')) return '#fbbf24'
  if (p.includes('def')) return '#60a5fa'
  if (p.includes('por')) return '#34d399'
  return '#94a3b8'
}
</script>

<template>
  <div class="team-view">
    <header class="page-header">
      <div class="header-main">
        <h1>Mi Equipo</h1>
        <div class="actions">
          <button @click="downloadTemplate" class="studio-btn-secondary">
            <Download :size="18" />
            Descargar Plantilla
          </button>
          <label class="studio-btn-primary">
            <FileUp :size="18" />
            Cargar Excel
            <input type="file" @change="handleFileUpload" accept=".xlsx,.xls" hidden />
          </label>
        </div>
      </div>
      <p>Gestiona la plantilla cargando tus datos desde Excel. Visualiza perfiles y estadísticas detalladas.</p>
    </header>

    <div v-if="players.length === 0 && !loading" class="empty-state glass-card gold-border">
      <div class="empty-icon-studio">
        <User :size="48" />
      </div>
      <h3>Plantilla Vacía</h3>
      <p>Importa tu archivo Excel para generar los cromos de los jugadores.</p>
      <button @click="downloadTemplate" class="text-btn">
        ¿No tienes la plantilla? Descárgala aquí
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="studio-spinner"></div>
      <p>Generando fichas de jugadores...</p>
    </div>

    <div v-if="players.length > 0" class="team-container">
      <div class="team-toolbar">
        <div class="search-box-studio">
          <Search :size="18" />
          <input v-model="searchQuery" type="text" placeholder="Buscar por nombre o posición..." />
        </div>
        <div class="stats-summary">
          <span>{{ players.length }} Jugadores</span>
        </div>
      </div>

      <div class="players-grid">
        <div v-for="player in filteredPlayers" :key="player.id" class="player-cromo glass-card">
          <div class="cromo-bg" :style="{ background: `linear-gradient(135deg, ${getPositionColor(player.posicion)}22 0%, rgba(0,0,0,0) 100%)` }"></div>
          
          <div class="player-photo">
            <div class="dorsal-tag">{{ player.dorsal }}</div>
            <img :src="player.foto" :alt="player.nombre" class="no-bg-photo" />
          </div>

          <div class="player-info">
            <span class="pos-badge" :style="{ backgroundColor: getPositionColor(player.posicion) }">
              {{ player.posicion }}
            </span>
            <h3 class="player-name">{{ player.nombre }}</h3>
            <div class="player-age">{{ player.edad }} años</div>
            
            <div class="stats-cromos">
              <div class="stat-item">
                <Target :size="14" />
                <span class="val">{{ player.goles }}</span>
                <span class="lab">Goles</span>
              </div>
              <div class="stat-item">
                <Activity :size="14" />
                <span class="val">{{ player.asistencias }}</span>
                <span class="lab">Asist</span>
              </div>
              <div class="stat-item">
                <Shield :size="14" />
                <span class="val">{{ player.partidos }}</span>
                <span class="lab">Part</span>
              </div>
            </div>
          </div>

          <div class="cromo-footer">
            <button class="view-btn">Ver Perfil</button>
          </div>
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

.actions {
  display: flex;
  gap: 12px;
}

.studio-btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
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

.empty-state {
  margin-top: 40px;
  padding: 80px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon-studio {
  background: rgba(59, 130, 246, 0.1);
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #3b82f6;
  margin-bottom: 8px;
}

.text-btn {
  background: transparent;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.team-container {
  margin-top: 24px;
}

.team-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.search-box-studio {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 16px;
  border-radius: 12px;
  width: 350px;
  border: 1px solid rgba(255,255,255,0.1);
}

.search-box-studio input {
  background: transparent;
  border: none;
  color: white;
  width: 100%;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

.player-cromo {
  position: relative;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.player-cromo:hover {
  transform: translateY(-10px);
  border-color: #3b82f6;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.cromo-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  pointer-events: none;
}

.player-photo {
  position: relative;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  margin-top: 10px;
}

.no-bg-photo {
  height: 100%;
  z-index: 1;
}

.dorsal-tag {
  position: absolute;
  top: 10px;
  left: 20px;
  font-size: 48px;
  font-weight: 900;
  color: rgba(255,255,255,0.1);
  font-style: italic;
}

.player-info {
  padding: 20px;
  text-align: center;
  flex-grow: 1;
}

.pos-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.player-name {
  margin: 0 0 4px;
  font-size: 18px;
}

.player-age {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 20px;
}

.stats-cromos {
  display: flex;
  justify-content: space-around;
  background: rgba(0,0,0,0.2);
  padding: 12px 8px;
  border-radius: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-item .val {
  font-weight: 700;
  font-size: 14px;
}

.stat-item .lab {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
}

.cromo-footer {
  padding: 16px;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid rgba(255,255,255,0.05);
}

.view-btn {
  width: 100%;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  background: #3b82f6;
  color: white;
}

.studio-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
