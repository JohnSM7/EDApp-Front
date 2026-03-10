<script setup lang="ts">
import { ref } from 'vue'
import { 
  Video, Scissors, Pencil, Plus, Trash2, 
  Download, Play, Pause, RotateCcw, Settings2,
  X, Save, Layout, FileText, Loader2
} from 'lucide-vue-next'
import { useAnalystStore, type Clip } from '../store/analyst'
import DrawingLayer from '../components/DrawingLayer.vue'
import JSZip from 'jszip'
import { recordVideoSegment } from '../utils/videoExport'

const analystStore = useAnalystStore()
const videoElement = ref<HTMLVideoElement | null>(null)
const videoUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

// Workspace States
const isDrawing = ref(false)
const isConfiguringTags = ref(false)
const selectedClip = ref<Clip | null>(null)
const processingClipId = ref<string | null>(null)
const recordingProgress = ref(0)
const isRecording = ref(false)
const batchProgress = ref({ current: 0, total: 0 })
const isBatchExporting = ref(false)

// Clipping State
const clipStart = ref<number | null>(null)
const clipEnd = ref<number | null>(null)

// Form States
const newTagName = ref('')
const newTagColor = ref('#3b82f6')
const newTagBefore = ref(5)
const newTagAfter = ref(5)

const handleVideoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoUrl.value = URL.createObjectURL(file)
  }
}

const togglePlay = () => {
  if (!videoElement.value) return
  if (videoElement.value.paused) {
    videoElement.value.play()
    isPlaying.value = true
  } else {
    videoElement.value.pause()
    isPlaying.value = false
  }
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const createClip = (tag: any) => {
  let start = clipStart.value
  let end = clipEnd.value

  if (start === null || end === null) {
    start = Math.max(0, currentTime.value - tag.durationBefore)
    end = Math.min(duration.value, currentTime.value + tag.durationAfter)
  }
  
  analystStore.addClip({
    name: `${tag.label} - ${formatTime(start)}`,
    startTime: start,
    endTime: end,
    tagId: tag.id,
    videoUrl: videoUrl.value!,
    notes: '',
    description: ''
  })

  clipStart.value = null
  clipEnd.value = null
}

const downloadClipAsMP4 = async (clip: Clip) => {
  if (!videoElement.value) return
  if (isRecording.value) {
    alert('Ya hay una grabación en curso. Por favor, espera.')
    return
  }
  
  try {
    processingClipId.value = clip.id
    isRecording.value = true
    recordingProgress.value = 0
    
    // Total duration of the clip
    const clipDuration = clip.endTime - clip.startTime
    
    // We update progress every 100ms
    const progressInterval = setInterval(() => {
      if (videoElement.value && isRecording.value) {
        const elapsed = videoElement.value.currentTime - clip.startTime
        recordingProgress.value = Math.min(100, Math.max(0, (elapsed / clipDuration) * 100))
      }
    }, 100)

    // We record the segment from the player
    const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime)
    clearInterval(progressInterval)
    
    // Create URL with explicit mime-type and trigger a robust download
    const url = URL.createObjectURL(blob)
    const sanitizedName = clip.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/gi, '_') 
      .toLowerCase()
    
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    // Use .mp4 whenever possible for Windows compatibility
    a.download = `${sanitizedName}.${extension}`
    
    document.body.appendChild(a)
    a.click()
    
    // Longer timeout before cleanup to ensure OS finishes handover
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)
    
  } catch (err: any) {
    console.error('Error recording clip:', err)
    alert(`Error al generar el video: ${err.message || 'Error desconocido'}`)
  } finally {
    processingClipId.value = null
    isRecording.value = false
    recordingProgress.value = 0
  }
}

const downloadAllClips = async () => {
  if (analystStore.clips.length === 0) return
  if (isRecording.value || isBatchExporting.value) return
  
  try {
    isBatchExporting.value = true
    batchProgress.value = { current: 0, total: analystStore.clips.length }
    
    const zip = new JSZip()
    const folder = zip.folder("recortes_partido")
    
    for (let i = 0; i < analystStore.clips.length; i++) {
      const clip = analystStore.clips[i]
      if (!clip) continue
      batchProgress.value.current = i + 1
      
      // We record each clip sequentially
      if (!videoElement.value) {
        throw new Error('El reproductor de video ha desaparecido durante la exportación.')
      }
      
      try {
        const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime)
        
        const sanitizedName = clip.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()
        
        folder?.file(`${sanitizedName}_${i}.${extension}`, blob)
      } catch (clipErr: any) {
        console.warn(`Clip ${i+1} falló, continuando...`, clipErr)
        // We continue with next clips even if one fails
      }
    }

    // Add metadata JSON
    const manifest = analystStore.clips.map(c => ({
      name: c.name,
      notes: c.notes || '',
      description: c.description || '',
      start: c.startTime,
      end: c.endTime
    }))
    zip.file('analisis_tactico_edapp.json', JSON.stringify(manifest, null, 2))

    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: "STORE" // Faster for videos
    })
    
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proyecto_analisis_completo.zip'
    a.click()
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    
  } catch (err: any) {
    console.error('Error en exportación masiva:', err)
    alert(`Error al exportar: ${err.message || 'Fallo de grabación'}`)
  } finally {
    isBatchExporting.value = false
    batchProgress.value = { current: 0, total: 0 }
  }
}
</script>

<template>
  <div class="analyst-studio">
    <!-- Main Toolbar -->
    <nav class="studio-nav glass-card">
      <div class="brand">
        <Video class="primary-icon" />
        <span>Studio Analista v2.0</span>
      </div>
      <div class="nav-actions">
        <button @click="isConfiguringTags = true" class="studio-btn-secondary" title="Configurar Botonera">
          <Settings2 :size="20" />
          Configurar
        </button>
        <button v-if="videoUrl" @click="downloadAllClips" class="studio-btn-primary" :disabled="isBatchExporting">
          <Download :size="18" />
          {{ isBatchExporting ? `Exportando ${batchProgress.current}/${batchProgress.total}` : 'Exportar Pack (ZIP)' }}
        </button>
      </div>
    </nav>

    <div v-if="!videoUrl" class="upload-placeholder">
       <div class="glass-card upload-box">
          <div class="icon-circle"><Video :size="48" /></div>
          <h2>Cargar Video del Partido</h2>
          <p>Formatos admitidos: MP4, MOV, WEBM. Máxima resolución 4K.</p>
          <label class="btn-primary">
            Importar Archivo
            <input type="file" @change="handleVideoUpload" accept="video/*" hidden>
          </label>
       </div>
    </div>

    <div v-else class="studio-layout">
      <!-- Left: Video Player -->
      <main class="player-container">
        <div class="video-window glass-card">
          <div class="video-frame">
            <video 
              ref="videoElement"
              :src="videoUrl"
              crossorigin="anonymous"
              @timeupdate="currentTime = ($event.target as HTMLVideoElement).currentTime"
              @loadedmetadata="duration = ($event.target as HTMLVideoElement).duration"
              class="main-video"
            ></video>
            <DrawingLayer :active="isDrawing" />
          </div>

          <!-- Professional Transport Controls -->
          <div class="transport-bar">
            <div class="seeker">
              <input 
                type="range" :max="duration" step="0.01" :value="currentTime"
                @input="videoElement!.currentTime = Number(($event.target as HTMLInputElement).value)"
              >
            </div>
            <div class="controls-row">
              <div class="grp">
                <button @click="videoElement!.currentTime -= 1/25" class="transport-btn"><RotateCcw :size="18" /> -1f</button>
                <button @click="togglePlay" class="play-btn">
                  <Pause v-if="isPlaying" :size="24" />
                  <Play v-else :size="24" />
                </button>
                <button @click="videoElement!.currentTime += 1/25" class="transport-btn">+1f <RotateCcw :size="18" style="transform: scaleX(-1)" /></button>
              </div>
              <div class="time-readout">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
              <div class="draw-tools">
                <button @click="isDrawing = !isDrawing" :class="{ active: isDrawing }" class="marker-btn">
                  <Pencil :size="18" />
                  {{ isDrawing ? 'CAPA DIBUJO ON' : 'DIBUJAR' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tagging Window (Integrated as Industrial Panel) -->
        <div class="tag-board glass-card">
          <div class="board-header">
            <h3>Botonera de Acción Táctica</h3>
            <button @click="isConfiguringTags = true" class="studio-btn-add"><Plus :size="14" /> Nuevo Botón</button>
          </div>
          <div class="tags-wall">
             <button 
              v-for="tag in analystStore.tags" :key="tag.id"
              class="action-tile"
              :style="{ '--tile-color': tag.color }"
              @click="createClip(tag)"
            >
              <span class="tile-label">{{ tag.label }}</span>
              <span class="tile-meta">{{ tag.durationBefore }}s / {{ tag.durationAfter }}s</span>
            </button>
          </div>
        </div>
      </main>

      <!-- Right: Clip Management & Editor -->
      <aside class="editor-sidebar">
        <!-- Clips List Panel -->
        <div class="clips-panel glass-card">
          <div class="panel-header">
             <h3>Recortes ({{ analystStore.clips.length }})</h3>
             <button class="icon-btn"><Layout :size="16" /></button>
          </div>
          
          <div class="clips-scroll">
            <div 
              v-for="clip in analystStore.clips" :key="clip.id"
              class="clip-card"
              :class="{ selected: selectedClip?.id === clip.id }"
              @click="selectedClip = clip"
            >
              <div class="clip-thumb">
                <Scissors :size="20" />
                <span>{{ formatTime(clip.startTime) }}</span>
              </div>
              <div class="clip-details">
                <span class="name">{{ clip.name }}</span>
                <span class="duration">{{ (clip.endTime - clip.startTime).toFixed(1) }}s</span>
              </div>
              <div class="clip-card-actions">
                <button 
                  @click.stop="downloadClipAsMP4(clip)" 
                  class="action-icon-btn download"
                  :disabled="isRecording || isBatchExporting"
                  :class="{ processing: processingClipId === clip.id }"
                >
                  <Loader2 v-if="processingClipId === clip.id" :size="14" class="spin" />
                  <Download v-else :size="14" />
                </button>
                <button @click.stop="analystStore.removeClip(clip.id)" class="action-icon-btn delete"><Trash2 :size="14" /></button>
              </div>
            </div>
          </div>
          
          <div v-if="isRecording || isBatchExporting" class="recording-status glass-card gold-border">
            <div class="status-msg">
              <Loader2 :size="16" class="spin" />
              <span v-if="isBatchExporting">Exportando {{ batchProgress.current }} de {{ batchProgress.total }}...</span>
              <span v-else>Grabando clip... ({{ recordingProgress.toFixed(0) }}%)</span>
            </div>
            <p class="status-tip">⚠️ <strong>No cambies de pestaña</strong> durante la exportación para asegurar la calidad.</p>
          </div>
        </div>

        <!-- Active Clip Editor -->
        <div class="detail-panel glass-card" v-if="selectedClip">
          <div class="panel-header">
            <h3>Editor de Clip</h3>
            <button @click="selectedClip = null" class="icon-btn"><X :size="16" /></button>
          </div>
          <div class="editor-form">
            <div class="input-group">
              <label>Nombre de la jugada</label>
              <input v-model="selectedClip.name" type="text" class="studio-input">
            </div>
            <div class="input-group">
              <label>Descripción táctica</label>
              <textarea v-model="selectedClip.description" placeholder="Análisis de movimientos..." rows="3" class="studio-input"></textarea>
            </div>
            <div class="input-group">
              <label>Notas para el entrenador</label>
              <textarea v-model="selectedClip.notes" placeholder="Puntos a mejorar..." rows="2" class="studio-input"></textarea>
            </div>
            <div class="times-grid">
              <div class="t-box"><span>Inicio:</span> {{ formatTime(selectedClip.startTime) }}</div>
              <div class="t-box"><span>Fin:</span> {{ formatTime(selectedClip.endTime) }}</div>
            </div>
            <button class="btn-primary full-width">
              <Save :size="18" /> 
              Guardar Cambios
            </button>
          </div>
        </div>
        
        <div v-else class="empty-editor glass-card">
          <FileText :size="32" />
          <p>Selecciona un clip para editar notas y detalles tácticos.</p>
        </div>
      </aside>
    </div>

    <!-- Modals -->
    <div v-if="isConfiguringTags" class="modal-overlay" @click.self="isConfiguringTags = false">
      <div class="modal glass-card">
        <div class="modal-header">
          <h2>Gestión de Botones</h2>
          <button @click="isConfiguringTags = false" class="icon-btn"><X :size="24" /></button>
        </div>
        <div class="modal-body">
           <div class="existing-tags">
             <div v-for="tag in analystStore.tags" :key="tag.id" class="manage-row">
               <div class="color-dot" :style="{ background: tag.color }"></div>
               <span class="tag-name">{{ tag.label }}</span>
               <span class="tag-time">{{ tag.durationBefore }}s / {{ tag.durationAfter }}s</span>
               <button @click="analystStore.removeTag(tag.id)" class="delete-tag-btn"><Trash2 :size="16" /></button>
             </div>
           </div>
           <div class="new-tag-form">
             <h4>Añadir nuevo botón de acción</h4>
             <input v-model="newTagName" type="text" placeholder="Ej: Transición Ofensiva" class="studio-input">
             <div class="times-config">
               <div class="t-input">
                 <label>Segs antes</label>
                 <input v-model.number="newTagBefore" type="number" class="studio-input">
               </div>
               <div class="t-input">
                 <label>Segs después</label>
                 <input v-model.number="newTagAfter" type="number" class="studio-input">
               </div>
               <input v-model="newTagColor" type="color" class="studio-color-picker">
             </div>
             <button 
                @click="analystStore.addTag(newTagName, newTagColor, newTagBefore, newTagAfter); newTagName = ''; isConfiguringTags = false" 
                class="btn-primary full-width"
              >
               Crear Botón
             </button>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analyst-studio {
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 50% 50%, #1a1f35 0%, #0f121d 100%);
  color: #e2e8f0;
  padding: 20px;
  overflow: hidden;
}

/* Studio Nav */
.studio-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  margin-bottom: 20px;
  border-radius: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
}

.primary-icon {
  color: var(--primary);
}

/* Layout */
.studio-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
  flex-grow: 1;
  overflow: hidden;
}

.player-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
}

/* Video Window */
.video-window {
  padding: 8px;
  background: rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
}

.video-frame {
  position: relative;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.main-video {
  width: 100%;
  height: 100%;
}

.transport-bar {
  padding: 12px 8px 4px;
}

.seeker input {
  width: 100%;
  accent-color: var(--primary);
  margin-bottom: 12px;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.grp {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-btn {
  width: 50px;
  height: 50px;
  background: var(--primary);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.transport-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Tag Board */
.tag-board {
  padding: 20px;
  flex-grow: 1;
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tags-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.action-tile {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 12px;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 4px solid var(--tile-color);
}

.action-tile:hover {
  background: var(--tile-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.tile-label {
  display: block;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.tile-meta {
  font-size: 10px;
  opacity: 0.6;
}

/* Editor Sidebar */
.editor-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
}

.clips-panel {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.clips-scroll {
  overflow-y: auto;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clip-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.clip-card:hover, .clip-card.selected {
  background: rgba(255,255,255,0.06);
  border-color: var(--primary);
}

.clip-thumb {
  width: 50px;
  height: 50px;
  background: #000;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}

.clip-thumb span {
  font-size: 10px;
  margin-top: 4px;
}

.clip-details {
  flex-grow: 1;
}

.clip-details .name {
  display: block;
  font-weight: 600;
  font-size: 13px;
}

.clip-details .duration {
  font-size: 11px;
  color: #94a3b8;
}

.clip-card-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-btn.processing {
  color: var(--primary);
}

.recording-status {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
}

.status-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 13px;
  color: var(--primary);
  margin-bottom: 4px;
}

.status-tip {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

/* Detail Panel / Editor */
.detail-panel {
  padding: 20px;
  height: 400px;
  background: rgba(59, 130, 246, 0.05);
}

.editor-form {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.studio-input {
  width: 100%;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  padding: 10px;
  color: white;
  font-size: 13px;
}

.times-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.t-box {
  background: rgba(0,0,0,0.2);
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
}

/* Modals & Helpers */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal {
  width: 100%;
  max-width: 600px;
  padding: 30px;
}

.manage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid var(--border-glass);
}

.new-tag-form {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-glass);
}

.times-config {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: flex-end;
  margin: 12px 0;
}

.studio-color-picker {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.upload-placeholder {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.upload-box {
  padding: 60px;
  max-width: 500px;
  text-align: center;
}

.icon-circle {
  width: 100px;
  height: 100px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 24px;
}

.empty-editor {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #94a3b8;
  gap: 16px;
}

.marker-btn.active {
  background: #ffeb3b;
  color: #000;
  border-color: #ffeb3b;
  box-shadow: 0 0 20px rgba(255, 235, 59, 0.4);
  transform: scale(1.05);
}

/* Improved Studio Buttons */
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

.studio-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.studio-btn-primary:disabled {
  opacity: 0.6;
  cursor: wait;
}

.studio-btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
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

.studio-btn-add {
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.studio-btn-add:hover {
  background: #10b981;
  color: white;
}

.action-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.action-icon-btn.download:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.action-icon-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.recording-status.gold-border {
  border: 1px solid rgba(255, 235, 59, 0.4);
  background: rgba(255, 235, 59, 0.05);
}

.status-tip strong {
  color: #ffeb3b;
}

.clip-details .name {
  color: #f8fafc;
}

.clip-card.selected {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  scale: 1.02;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recording-status {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
}

.status-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 13px;
  color: var(--primary);
  margin-bottom: 4px;
}

.status-tip {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
</style>
