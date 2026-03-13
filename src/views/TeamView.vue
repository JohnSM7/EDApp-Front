<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { FileUp, Search, Download, User, Activity, Target, X, Calendar, TrendingUp, PlayCircle, Plus, Video } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

interface Player {
  id: number;
  nombre: string;
  edad: number;
  lugarNacimiento: string;
  posicion: string;
  pieDominante: string;
  lateralidad: string;
  altura: number; // in cm
  peso: number;   // in kg
  foto?: string;
  heatmap?: string; // DataURL or URL
  videos?: { title: string, url: string }[];
  dorsal?: number;
}

const players = ref<Player[]>([])
const loading = ref(false)

// Persistence Layer
onMounted(() => {
  const savedPlayers = localStorage.getItem('edapp_team_players')
  if (savedPlayers) {
    try {
      players.value = JSON.parse(savedPlayers)
    } catch (e) {
      console.error('Error loading saved players:', e)
    }
  }
})

watch(players, (newVal) => {
  localStorage.setItem('edapp_team_players', JSON.stringify(newVal))
}, { deep: true })
const searchQuery = ref('')
const selectedPlayer = ref<Player | null>(null)
const isAddingPlayer = ref(false)
const isEditingProfile = ref(false)
const photoPreview = ref<string | null>(null)

const newPlayer = ref<Omit<Player, 'id'>>({
  nombre: '',
  edad: 20,
  lugarNacimiento: '',
  posicion: 'Delantero',
  pieDominante: 'Derecho',
  lateralidad: 'Derecha',
  altura: 180,
  peso: 75,
  foto: '',
  heatmap: '',
  videos: [],
  dorsal: 1
})

const editForm = ref<Player | null>(null)

const filteredPlayers = computed(() => {
  if (!searchQuery.value) return players.value
  return players.value.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    p.posicion.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const downloadTemplate = () => {
  const template = [
    { 
      Nombre: 'Lionel Messi', 
      Edad: 36, 
      Lugar_Nacimiento: 'Rosario, Argentina',
      Posicion: 'Delantero', 
      Pie_Dominante: 'Izquierdo',
      Lateralidad: 'Izquierda',
      Altura_cm: 170,
      Peso_kg: 72,
      Dorsal: 10,
      Foto: '' 
    }
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
      if (!sheetName) throw new Error('No sheets found')
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) throw new Error('Worksheet is undefined')
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)
      
      players.value = json.map((p, index) => ({
        id: index + 1,
        nombre: p.Nombre || p.nombre || 'Jugador',
        edad: p.Edad || p.edad || 0,
        lugarNacimiento: p.Lugar_Nacimiento || p.lugar_nacimiento || 'N/A',
        posicion: p.Posicion || p.posicion || 'N/A',
        pieDominante: p.Pie_Dominante || p.pie_dominante || 'Derecho',
        lateralidad: p.Lateralidad || p.lateralidad || 'Derecha',
        altura: p.Altura_cm || p.altura || 0,
        peso: p.Peso_kg || p.peso || 0,
        dorsal: p.Dorsal || p.dorsal || 0,
        foto: p.Foto || p.foto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.Nombre || index}&backgroundColor=transparent`
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

const openPlayerProfile = (player: Player) => {
  selectedPlayer.value = player
}

const closePlayerProfile = () => {
  selectedPlayer.value = null
}

const addPlayer = () => {
  const idValue = players.value.length > 0 ? Math.max(...players.value.map(p => p.id)) + 1 : 1
  players.value.push({
    ...newPlayer.value,
    id: idValue,
    foto: newPlayer.value.foto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newPlayer.value.nombre || 'new'}&backgroundColor=transparent`
  })
  isAddingPlayer.value = false
  photoPreview.value = null
  // Reset form
  newPlayer.value = {
    nombre: '',
    edad: 20,
    lugarNacimiento: '',
    posicion: 'Delantero',
    pieDominante: 'Derecho',
    lateralidad: 'Derecha',
    altura: 180,
    peso: 75,
    foto: '',
    heatmap: '',
    videos: [],
    dorsal: 1
  }
}

const handlePhotoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    newPlayer.value.foto = result
    photoPreview.value = result
  }
  reader.readAsDataURL(file)
}

const startEditing = () => {
  if (selectedPlayer.value) {
    editForm.value = { ...selectedPlayer.value }
    photoPreview.value = selectedPlayer.value.foto || null
    isEditingProfile.value = true
  }
}

const updatePlayer = () => {
  if (editForm.value) {
    const index = players.value.findIndex(p => p.id === editForm.value!.id)
    if (index !== -1) {
      players.value[index] = { ...editForm.value }
      selectedPlayer.value = { ...editForm.value }
    }
    isEditingProfile.value = false
    photoPreview.value = null
  }
}

const deletePlayer = (id: number) => {
  if (confirm('¿Estás seguro de que quieres eliminar a este jugador de la plantilla?')) {
    players.value = players.value.filter(p => p.id !== id)
    selectedPlayer.value = null
  }
}

const handleEditPhotoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !editForm.value) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    editForm.value!.foto = result
    photoPreview.value = result
  }
  reader.readAsDataURL(file)
}

const handleHeatmapUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    newPlayer.value.heatmap = result
  }
  reader.readAsDataURL(file)
}

const handleEditHeatmapUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !editForm.value) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    editForm.value!.heatmap = result
  }
  reader.readAsDataURL(file)
}

const videoTemp = ref({ title: '', url: '' })

const addVideoToNew = () => {
  if (videoTemp.value.title && videoTemp.value.url) {
    if (!newPlayer.value.videos) newPlayer.value.videos = []
    newPlayer.value.videos.push({ ...videoTemp.value })
    videoTemp.value = { title: '', url: '' }
  }
}

const addVideoToEdit = () => {
  if (videoTemp.value.title && videoTemp.value.url && editForm.value) {
    if (!editForm.value.videos) editForm.value.videos = []
    editForm.value.videos.push({ ...videoTemp.value })
    videoTemp.value = { title: '', url: '' }
  }
}
</script>

<template>
  <div class="team-view">
    <header class="page-header">
      <div class="header-main">
        <h1>Mi Equipo</h1>
        <div class="actions">
          <button @click="isAddingPlayer = true" class="studio-btn-secondary">
            <User :size="18" />
            Nuevo Jugador
          </button>
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


    <div v-if="loading" class="loading-state">
      <div class="studio-spinner"></div>
      <p>Generando fichas de jugadores...</p>
    </div>

    <div v-if="!loading" class="team-container">
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
        <!-- Add Player Card -->
        <div class="add-player-card glass-card gold-border" @click="isAddingPlayer = true">
          <div class="add-icon">
            <Activity :size="32" />
          </div>
          <h3>Agregar Jugador</h3>
          <p>Individual</p>
        </div>

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
                <span class="val">{{ player.altura }}</span>
                <span class="lab">cm</span>
              </div>
              <div class="stat-item">
                <Activity :size="14" />
                <span class="val">{{ player.peso }}</span>
                <span class="lab">kg</span>
              </div>
              <div class="stat-item">
                <TrendingUp :size="14" />
                <span class="val">{{ player.pieDominante === 'Derecho' ? 'R' : player.pieDominante === 'Izquierdo' ? 'L' : 'B' }}</span>
                <span class="lab">Pie</span>
              </div>
            </div>
          </div>

          <div class="cromo-footer">
            <button class="view-btn" @click="openPlayerProfile(player)">Ver Perfil</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Player Modal -->
    <div v-if="isAddingPlayer" class="modal-overlay" @click.self="isAddingPlayer = false">
      <div class="modal glass-card player-form-modal">
        <div class="modal-header">
          <h2>Nuevo Jugador</h2>
          <button @click="isAddingPlayer = false" class="icon-btn-circle"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="photo-upload-section">
            <div class="photo-preview-large glass-card">
              <img v-if="photoPreview" :src="photoPreview" class="preview-img" />
              <User v-else :size="48" class="placeholder-icon" />
            </div>
            <label class="studio-btn-secondary mini">
              <FileUp :size="14" />
              {{ photoPreview ? 'Cambiar Foto' : 'Subir Foto' }}
              <input type="file" @change="handlePhotoUpload" accept="image/*" hidden />
            </label>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Nombre Completo</label>
              <input v-model="newPlayer.nombre" type="text" placeholder="Ej: Pedri" class="studio-input">
            </div>
            <div class="input-group">
              <label>Edad</label>
              <input v-model.number="newPlayer.edad" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Lugar de Nacimiento</label>
              <input v-model="newPlayer.lugarNacimiento" type="text" placeholder="Ciudad, País" class="studio-input">
            </div>
            <div class="input-group">
              <label>Posición</label>
              <select v-model="newPlayer.posicion" class="studio-input">
                <option>Portero</option>
                <option>Defensa</option>
                <option>Centrocampista</option>
                <option>Delantero</option>
              </select>
            </div>
            <div class="input-group">
              <label>Pie Dominante</label>
              <select v-model="newPlayer.pieDominante" class="studio-input">
                <option>Derecho</option>
                <option>Izquierdo</option>
                <option>Ambidiestro</option>
              </select>
            </div>
            <div class="input-group">
              <label>Lateralidad</label>
              <select v-model="newPlayer.lateralidad" class="studio-input">
                <option>Derecha</option>
                <option>Izquierda</option>
              </select>
            </div>
            <div class="input-group">
              <label>Altura (cm)</label>
              <input v-model.number="newPlayer.altura" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Peso (kg)</label>
              <input v-model.number="newPlayer.peso" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Dorsal</label>
              <input v-model.number="newPlayer.dorsal" type="number" class="studio-input">
            </div>
          </div>

          <div class="analysis-form-section">
            <h4><Target :size="16" /> Análisis Táctico (Mapa de Calor)</h4>
            <div class="heatmap-upload-area">
              <div v-if="newPlayer.heatmap" class="heatmap-preview-mini">
                <img :src="newPlayer.heatmap" />
              </div>
              <label class="studio-btn-secondary mini">
                <FileUp :size="14" />
                {{ newPlayer.heatmap ? 'Cambiar Mapa' : 'Subir Mapa de Calor' }}
                <input type="file" @change="handleHeatmapUpload" accept="image/*" hidden />
              </label>
            </div>
          </div>

          <div class="analysis-form-section">
            <h4><Video :size="16" /> Vídeos de Referencia</h4>
            <div class="video-add-form">
              <input v-model="videoTemp.title" type="text" placeholder="Título (Ej: Scouting vs Madrid)" class="studio-input">
              <input v-model="videoTemp.url" type="text" placeholder="URL del vídeo" class="studio-input">
              <button @click="addVideoToNew" class="icon-btn-circle plus-btn"><Plus :size="16" /></button>
            </div>
            <div class="video-list-mini" v-if="newPlayer.videos && newPlayer.videos.length > 0">
              <div v-for="(v, i) in newPlayer.videos" :key="i" class="v-mini-item">
                <Video :size="12" />
                <span>{{ v.title }}</span>
                <button @click="newPlayer.videos.splice(i, 1)" class="remove-v">×</button>
              </div>
            </div>
          </div>

          <button @click="addPlayer" class="studio-btn-primary full-width margin-top">
            Añadir a la Plantilla
          </button>
        </div>
      </div>
    </div>

    <!-- Player Profile Modal -->
    <div v-if="selectedPlayer" class="modal-overlay" @click.self="closePlayerProfile">
      <div class="modal glass-card profile-modal">
        <button class="close-modal-btn" @click="closePlayerProfile">
          <X :size="24" />
        </button>
        
        <div class="modal-header-profile" :style="{ background: `linear-gradient(135deg, ${getPositionColor(selectedPlayer.posicion)}44 0%, rgba(0,0,0,0) 100%)` }">
          <div class="profile-photo-container">
             <img :src="selectedPlayer.foto" :alt="selectedPlayer.nombre" class="profile-photo" />
             <div class="profile-dorsal" :style="{ color: getPositionColor(selectedPlayer.posicion) }">{{ selectedPlayer.dorsal }}</div>
          </div>
          <div class="profile-title">
            <h2>{{ selectedPlayer.nombre }}</h2>
            <span class="pos-badge-large" :style="{ backgroundColor: getPositionColor(selectedPlayer.posicion) }">
              {{ selectedPlayer.posicion }}
            </span>
          </div>
        </div>
        
        <div class="modal-body-profile extended-layout">
          <!-- Left Column: Biography -->
          <div class="profile-left-col">
            <div class="profile-stats-grid biographical">
              <div class="bio-item">
                <Calendar class="bio-icon" :size="20" />
                <div class="bio-content">
                  <span class="bio-label">Edad</span>
                  <span class="bio-val">{{ selectedPlayer.edad }} años</span>
                </div>
              </div>
              <div class="bio-item">
                <Search class="bio-icon" :size="20" />
                <div class="bio-content">
                  <span class="bio-label">Nacimiento</span>
                  <span class="bio-val">{{ selectedPlayer.lugarNacimiento }}</span>
                </div>
              </div>
              <div class="bio-item">
                <Target class="bio-icon" :size="20" />
                <div class="bio-content">
                  <span class="bio-label">Pie Dominante</span>
                  <span class="bio-val">{{ selectedPlayer.pieDominante }}</span>
                </div>
              </div>
              <div class="bio-item">
                <Activity class="bio-icon" :size="20" />
                <div class="bio-content">
                  <span class="bio-label">Lateralidad</span>
                  <span class="bio-val">{{ selectedPlayer.lateralidad }}</span>
                </div>
              </div>
              <div class="bio-item">
                <TrendingUp class="bio-icon" :size="20" />
                <div class="bio-content">
                  <span class="bio-label">Altura / Peso</span>
                  <span class="bio-val">{{ selectedPlayer.altura }} cm / {{ selectedPlayer.peso }} kg</span>
                </div>
              </div>
            </div>

            <div class="profile-actions-footer">
              <button @click="startEditing" class="studio-btn-secondary full-width">
                <Activity :size="18" />
                Editar Jugador
              </button>
              <button @click="deletePlayer(selectedPlayer.id)" class="delete-btn-text">
                Eliminar Jugador
              </button>
            </div>
          </div>

          <!-- Right Column: Analysis -->
          <div class="profile-right-col">
            <div class="analysis-section heatmap-container glass-card">
              <div class="section-header">
                <h3><Target :size="20" /> Mapa de Calor (Zona de Influencia)</h3>
              </div>
              <div class="heatmap-canvas">
                <img v-if="selectedPlayer.heatmap" :src="selectedPlayer.heatmap" class="heatmap-img" />
                <div v-else class="heatmap-placeholder">
                  <div class="field-lines"></div>
                  <div class="heat-blob"></div>
                  <span class="placeholder-text">Sube un mapa de calor en la edición</span>
                </div>
              </div>
            </div>

            <div class="analysis-section videos-container glass-card">
              <div class="section-header">
                <h3><Video :size="20" /> Videos de Referencia / Scouting</h3>
              </div>
              <div class="videos-grid">
                <div v-if="selectedPlayer.videos && selectedPlayer.videos.length > 0" class="video-list">
                  <div v-for="(vid, idx) in selectedPlayer.videos" :key="idx" class="video-reference-item glass-card">
                    <div class="video-thumb">
                      <PlayCircle :size="32" />
                    </div>
                    <div class="video-info">
                      <span class="video-title">{{ vid.title }}</span>
                      <a :href="vid.url" target="_blank" class="video-link">Ver Análisis</a>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-videos">
                  <Video :size="48" />
                  <p>Aún no hay videos vinculados a este perfil</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Player Modal -->
    <div v-if="isEditingProfile && editForm" class="modal-overlay" @click.self="isEditingProfile = false">
      <div class="modal glass-card player-form-modal">
        <div class="modal-header">
          <h2>Editar Jugador: {{ editForm.nombre }}</h2>
          <button @click="isEditingProfile = false" class="icon-btn-circle"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="photo-upload-section">
            <div class="photo-preview-large glass-card">
              <img v-if="photoPreview" :src="photoPreview" class="preview-img" />
              <User v-else :size="48" class="placeholder-icon" />
            </div>
            <label class="studio-btn-secondary mini">
              <FileUp :size="14" />
              Cambiar Foto
              <input type="file" @change="handleEditPhotoUpload" accept="image/*" hidden />
            </label>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Nombre Completo</label>
              <input v-model="editForm.nombre" type="text" class="studio-input">
            </div>
            <div class="input-group">
              <label>Edad</label>
              <input v-model.number="editForm.edad" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Lugar de Nacimiento</label>
              <input v-model="editForm.lugarNacimiento" type="text" class="studio-input">
            </div>
            <div class="input-group">
              <label>Posición</label>
              <select v-model="editForm.posicion" class="studio-input">
                <option>Portero</option>
                <option>Defensa</option>
                <option>Centrocampista</option>
                <option>Delantero</option>
              </select>
            </div>
            <div class="input-group">
              <label>Pie Dominante</label>
              <select v-model="editForm.pieDominante" class="studio-input">
                <option>Derecho</option>
                <option>Izquierdo</option>
                <option>Ambidiestro</option>
              </select>
            </div>
            <div class="input-group">
              <label>Lateralidad</label>
              <select v-model="editForm.lateralidad" class="studio-input">
                <option>Derecha</option>
                <option>Izquierda</option>
              </select>
            </div>
            <div class="input-group">
              <label>Altura (cm)</label>
              <input v-model.number="editForm.altura" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Peso (kg)</label>
              <input v-model.number="editForm.peso" type="number" class="studio-input">
            </div>
            <div class="input-group">
              <label>Dorsal</label>
              <input v-model.number="editForm.dorsal" type="number" class="studio-input">
            </div>
          </div>

          <div class="analysis-form-section">
            <h4><Target :size="16" /> Análisis Táctico (Mapa de Calor)</h4>
            <div class="heatmap-upload-area">
              <div v-if="editForm.heatmap" class="heatmap-preview-mini">
                <img :src="editForm.heatmap" />
              </div>
              <label class="studio-btn-secondary mini">
                <FileUp :size="14" />
                {{ editForm.heatmap ? 'Cambiar Mapa' : 'Subir Mapa de Calor' }}
                <input type="file" @change="handleEditHeatmapUpload" accept="image/*" hidden />
              </label>
            </div>
          </div>

          <div class="analysis-form-section">
            <h4><Video :size="16" /> Vídeos de Referencia</h4>
            <div class="video-add-form">
              <input v-model="videoTemp.title" type="text" placeholder="Título del vídeo" class="studio-input">
              <input v-model="videoTemp.url" type="text" placeholder="URL del vídeo" class="studio-input">
              <button @click="addVideoToEdit" class="icon-btn-circle plus-btn"><Plus :size="16" /></button>
            </div>
            <div class="video-list-mini" v-if="editForm.videos && editForm.videos.length > 0">
              <div v-for="(v, i) in editForm.videos" :key="i" class="v-mini-item">
                <Video :size="12" />
                <span>{{ v.title }}</span>
                <button @click="editForm.videos.splice(i, 1)" class="remove-v">×</button>
              </div>
            </div>
          </div>

          <button @click="updatePlayer" class="studio-btn-primary full-width margin-top">
            Guardar Cambios
          </button>
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

/* Add Player Card */
.add-player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  border-style: dashed;
  background: rgba(59, 130, 246, 0.03);
  transition: all 0.3s;
  min-height: 280px;
}

.add-player-card:hover {
  background: rgba(59, 130, 246, 0.08);
  transform: translateY(-5px);
  border-color: #3b82f6;
}

.add-icon {
  width: 64px;
  height: 64px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #3b82f6;
  margin-bottom: 20px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.add-player-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.add-player-card p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
}

/* Manual Form Modal */
.player-form-modal {
  width: 100%;
  max-width: 500px;
  background: #1e293b;
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-body {
  padding: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.studio-input {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 10px 14px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
}

.studio-input:focus {
  border-color: #3b82f6;
  outline: none;
}

.stats-form-group {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.stats-form-group h4 {
  margin: 0 0 16px;
  font-size: 14px;
  color: #fbbf24;
}

.icon-btn-circle {
  background: rgba(255,255,255,0.05);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

/* Photo Upload */
.photo-upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.photo-preview-large {
  width: 120px;
  height: 120px;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-icon {
  color: rgba(255,255,255,0.2);
}

.studio-btn-secondary.mini {
  padding: 6px 12px;
  font-size: 12px;
}

/* Biographical Profile Styles */
.profile-stats-grid.biographical {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bio-item {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255,255,255,0.03);
  padding: 16px 24px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.05);
}

.bio-icon {
  color: #3b82f6;
  opacity: 0.8;
}

.bio-content {
  display: flex;
  flex-direction: column;
}

.bio-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 1px;
}

.bio-val {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.delete-btn-text {
  background: transparent;
  border: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.delete-btn-text:hover {
  opacity: 1;
  text-decoration: underline;
}

.full-width { width: 100%; }
.margin-top { margin-top: 24px; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.modal.profile-modal {
  width: 95vw;
  max-width: 1200px;
  max-height: 90vh;
  padding: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #111827;
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: modalIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.close-modal-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(0,0,0,0.5);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
}

.close-modal-btn:hover {
  background: rgba(239, 68, 68, 0.8);
  transform: rotate(90deg);
}

.modal-header-profile {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 32px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(0,0,0,0.2);
}

.profile-photo-container {
  position: relative;
  width: 50px;
  height: 50px;
  background: rgba(0,0,0,0.3);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.profile-photo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
 Arkansas

.profile-dorsal {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #3b82f6;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 10px;
  font-weight: 800;
  color: white;
}

.profile-title h2 {
  font-size: 24px;
  margin: 0 0 4px 0;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
}

.pos-badge-large {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.modal-body-profile.extended-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
  padding: 32px;
  overflow-y: auto;
  flex: 1;
}

.profile-left-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-right-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.analysis-section {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.05);
  height: 100%;
}

.section-header h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  color: #60a5fa;
  margin: 0 0 20px 0;
}

/* Heatmap Canvas */
.heatmap-canvas {
  width: 100%;
  aspect-ratio: 1.6/1;
  background: #0f172a;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}

.heatmap-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.heatmap-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
}

.field-lines {
  position: absolute;
  top: 10%; bottom: 10%; left: 5%; right: 5%;
  border: 1px solid rgba(255,255,255,0.1);
}

.field-lines::after {
  content: '';
  position: absolute;
  left: 50%; top: 0; bottom: 0;
  border-left: 1px solid rgba(255,255,255,0.1);
}

.heat-blob {
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0) 70%);
  filter: blur(8px);
  position: absolute;
  top: 40%; left: 50%;
  transform: translate(-50%, -50%);
}

.placeholder-text {
  z-index: 2;
  color: #64748b;
  font-size: 13px;
}

/* Reference Videos */
.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.video-reference-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  transition: all 0.2s;
}

.video-reference-item:hover {
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
}

.video-thumb {
  width: 56px;
  height: 56px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #60a5fa;
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-title {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.video-link {
  font-size: 12px;
  color: #60a5fa;
  text-decoration: none;
  font-weight: 500;
}

.video-link:hover {
  text-decoration: underline;
}

.empty-videos {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #475569;
  gap: 12px;
}

.empty-videos p {
  margin: 0;
  font-size: 14px;
}

.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-box {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s;
}

.stat-box:hover {
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
}

.stat-icon {
  color: #3b82f6;
}

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-text .value {
  font-size: 24px;
  font-weight: 700;
}

.stat-text .label {
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.performance-summary {
  background: rgba(59, 130, 246, 0.05);
  border-left: 4px solid #3b82f6;
  padding: 24px;
  border-radius: 0 12px 12px 0;
}

.performance-summary h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #60a5fa;
}

/* Analysis Form Sections */
.analysis-form-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.analysis-form-section h4 {
  margin: 0 0 16px;
  font-size: 13px;
  color: #60a5fa;
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.heatmap-upload-area {
  display: flex;
  align-items: center;
  gap: 20px;
}

.heatmap-preview-mini {
  width: 100px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  background: #000;
}

.heatmap-preview-mini img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-add-form {
  display: flex;
  gap: 10px;
  margin-bottom:  profile-stats-grid;
}

.video-add-form .studio-input {
  flex: 1;
  font-size: 12px;
}

.plus-btn {
  background: #3b82f6 !important;
  flex-shrink: 0;
}

.video-list-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.v-mini-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  color: #60a5fa;
}

.remove-v {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-weight: bold;
  padding: 0 0 0 4px;
}
</style>
