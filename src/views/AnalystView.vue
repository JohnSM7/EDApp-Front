<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { 
  Video, Scissors, Pencil, Trash2, 
  Download, Play, Pause, RotateCcw, Settings2,
  X, Save, Layout, FileText, Loader2, PlayCircle, Check,
  Volume2, VolumeX, Maximize
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
const volume = ref(1)
const isMuted = ref(false)

// Workspace States
const isDrawing = ref(false)
const isConfiguringTags = ref(false)
const selectedClip = ref<Clip | null>(null)
const isConsoleExternal = ref(false)
const processingClipId = ref<string | null>(null)
const recordingProgress = ref(0)
const isRecording = ref(false)
const batchProgress = ref({ current: 0, total: 0 })
const isBatchExporting = ref(false)

// Window communication
const consoleChannel = new BroadcastChannel('analyst-console')

const groupedTags = computed(() => {
  const groups: Record<string, any[]> = {}
  analystStore.tags.forEach(tag => {
    if (!groups[tag.category]) groups[tag.category] = []
    groups[tag.category]!.push(tag)
  })
  return groups
})

consoleChannel.onmessage = (event) => {
  if (event.data.type === 'CREATE_CLIP' && event.data.tag) {
    createClip(event.data.tag)
  }
  if (event.data.type === 'RESTORE_CONSOLE') {
    isConsoleExternal.value = false
  }
  if (event.data.type === 'SKIP_VIDEO') {
    skipTime(event.data.amount)
  }
  if (event.data.type === 'TOGGLE_PLAY') {
    togglePlay()
  }
  if (event.data.type === 'TOGGLE_MUTE') {
    toggleMute()
  }
  if (event.data.type === 'SET_VOLUME') {
    updateVolume(event.data.volume)
  }
  if (event.data.type === 'TOGGLE_FULLSCREEN') {
    toggleFullscreen()
  }
  if (event.data.type === 'REQUEST_STATE') {
    consoleChannel.postMessage({
      type: 'STATE_UPDATE',
      state: { isPlaying: isPlaying.value, volume: volume.value, isMuted: isMuted.value }
    })
  }
}

watch([isPlaying, volume, isMuted], ([newIsPlaying, newVolume, newIsMuted]) => {
  consoleChannel.postMessage({
    type: 'STATE_UPDATE',
    state: { isPlaying: newIsPlaying, volume: newVolume, isMuted: newIsMuted }
  })
})

const openConsoleWindow = () => {
  const width = 850
  const height = 400
  const left = (window.screen.width - width) / 2
  const top = window.screen.height - height - 100
  
  isConsoleExternal.value = true
  
  const consoleWindow = window.open(
    '/analyst/console', 
    'TacticalConsole', 
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  )

  const checkClosed = setInterval(() => {
    if (consoleWindow?.closed) {
      isConsoleExternal.value = false
      clearInterval(checkClosed)
    }
  }, 1000)
}

// Clipping State
const clipStart = ref<number | null>(null)
const clipEnd = ref<number | null>(null)

// Form States
const newTagName = ref('')
const newTagCategory = ref('Ataque')
const newTagColor = ref('#3b82f6')
const newTagBefore = ref(5)
const newTagAfter = ref(5)

// Clip Editor Zoom Settings
const clipEditorWindowStart = ref(0)
const clipEditorWindowEnd = ref(0)
const PADDING_SECONDS = 15

// Preview state
const isPreviewing = ref(false)
let previewInterval: ReturnType<typeof setInterval> | null = null

watch(selectedClip, (newClip) => {
  if (newClip) {
    // Stop any existing preview
    stopPreview()
    
    // Zoom the timeline to focus only on the clip + padding
    const start = Math.max(0, newClip.startTime - PADDING_SECONDS)
    const end = Math.min(duration.value, newClip.endTime + PADDING_SECONDS)
    
    clipEditorWindowStart.value = start
    clipEditorWindowEnd.value = Math.max(end, start + 20)
    
    // Auto-seek the video player to the start of the clip
    setTimeout(() => {
      if (newClip && selectedClip.value?.id === newClip.id) {
        seekTo(newClip.startTime)
      }
    }, 100)
  } else {
    stopPreview()
  }
})

const stopPreview = () => {
  isPreviewing.value = false
  if (previewInterval) {
    clearInterval(previewInterval)
    previewInterval = null
  }
  if (videoElement.value && !videoElement.value.paused) {
    videoElement.value.pause()
    isPlaying.value = false
  }
}

const previewClip = () => {
  if (!videoElement.value || !selectedClip.value) return
  
  // Stop existing preview interval
  if (previewInterval) clearInterval(previewInterval)
  
  // Seek and Play
  videoElement.value.currentTime = selectedClip.value.startTime
  videoElement.value.play()
  isPlaying.value = true
  isPreviewing.value = true
  
  // Poll to pause when it hits the end of the clip
  previewInterval = setInterval(() => {
    if (videoElement.value && selectedClip.value) {
      if (videoElement.value.currentTime >= selectedClip.value.endTime) {
        stopPreview()
        // Reset player precisely to the end time
        videoElement.value.currentTime = selectedClip.value.endTime
      }
    }
  }, 100)
}

// Save status
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const lastSavedClipId = ref<string | null>(null)

const handleSave = () => {
  if (!selectedClip.value) return
  saveStatus.value = 'saving'
  
  const currentId = selectedClip.value.id
  
  // Simulate a save process
  setTimeout(() => {
    saveStatus.value = 'saved'
    lastSavedClipId.value = currentId
    
    setTimeout(() => {
      saveStatus.value = 'idle'
      lastSavedClipId.value = null
    }, 2000)
  }, 500)
}

onUnmounted(() => {
  stopPreview()
  window.removeEventListener('keydown', handleKeyDown)
})

const handleKeyDown = (event: KeyboardEvent) => {
  // Evitar que las flechas o el espacio disparen el scroll de la página si el foco está cerca o en el video
  if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    // Si estamos escribiendo en un input o textarea, no hacemos nada
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    event.preventDefault()
    if (event.key === 'ArrowLeft') {
      skipTime(-5)
    } else if (event.key === 'ArrowRight') {
      skipTime(5)
    } else if (event.key === ' ') {
      togglePlay()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

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
  if (!seconds || isNaN(seconds)) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

const skipTime = (amount: number) => {
  if (!videoElement.value) return
  // Pause if it was playing to prevent erratic behavior when jumping quickly
  const wasPlaying = isPlaying.value
  if (wasPlaying) videoElement.value.pause()
  
  let newTime = videoElement.value.currentTime + amount
  if (newTime < 0) newTime = 0
  if (newTime > duration.value) newTime = duration.value
  
  videoElement.value.currentTime = newTime
  currentTime.value = newTime
  
  if (wasPlaying) videoElement.value.play()
}

const seekTo = (time: number) => {
  if (!videoElement.value) return
  videoElement.value.currentTime = time
  currentTime.value = time
}

const toggleMute = () => {
  if (!videoElement.value) return
  isMuted.value = !isMuted.value
  videoElement.value.muted = isMuted.value
}

const updateVolume = (val: number) => {
  if (!videoElement.value) return
  volume.value = val
  videoElement.value.volume = val
  if (val > 0) {
    isMuted.value = false
    videoElement.value.muted = false
  }
}

const toggleFullscreen = () => {
  if (!videoElement.value) return
  const container = videoElement.value.parentElement
  if (!container) return

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
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

const updateClipStart = (val: number) => {
  if (!selectedClip.value) return
  // Prevent start from surpassing end
  const newVal = Math.min(val, selectedClip.value.endTime - 0.5)
  selectedClip.value.startTime = newVal
  seekTo(newVal)
}

const updateClipEnd = (val: number) => {
  if (!selectedClip.value) return
  // Prevent end from going below start
  const newVal = Math.max(val, selectedClip.value.startTime + 0.5)
  selectedClip.value.endTime = newVal
  seekTo(newVal)
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
    const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime, analystStore.drawings)
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
        const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime, analystStore.drawings)
        
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
        <button v-if="!isConsoleExternal" @click="openConsoleWindow" class="studio-btn-secondary" title="Separar Consola">
          <Layout :size="20" />
          Ventana Externa
        </button>
        <button v-else @click="isConsoleExternal = false" class="studio-btn-primary" title="Traer Consola">
          <Layout :size="20" />
          Integrar Consola
        </button>
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
            <DrawingLayer :active="isDrawing" :current-time="currentTime" />
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
                <button @click="skipTime(-5)" class="transport-btn"><RotateCcw :size="18" /> -5s</button>
                <button @click="togglePlay" class="play-btn">
                  <Pause v-if="isPlaying" :size="24" />
                  <Play v-else :size="24" />
                </button>
                <button @click="skipTime(5)" class="transport-btn">+5s <RotateCcw :size="18" style="transform: scaleX(-1)" /></button>
                
                <div class="volume-control">
                  <button @click="toggleMute" class="transport-btn">
                    <VolumeX v-if="isMuted || volume === 0" :size="18" />
                    <Volume2 v-else :size="18" />
                  </button>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    :value="volume" 
                    @input="updateVolume(Number(($event.target as HTMLInputElement).value))"
                    class="volume-slider"
                  >
                </div>
              </div>

              <div class="time-readout">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
              
              <div class="draw-tools">
                <button @click="toggleFullscreen" class="transport-btn" title="Pantalla Completa">
                  <Maximize :size="18" />
                </button>
                <button @click="isDrawing = !isDrawing" :class="{ active: isDrawing }" class="marker-btn">
                  <Pencil :size="18" />
                  {{ isDrawing ? 'CAPA DIBUJO ON' : 'DIBUJAR' }}
                </button>
              </div>
            </div>
          </div>
        </div>


        <!-- Integrated Tag Board (Grouped) -->
        <div v-if="!isConsoleExternal" class="integrated-console gold-border">
          <div class="console-body">
            <div class="groups-container">
              <div v-for="(tags, category) in groupedTags" :key="category" class="tag-group">
                <div class="group-header">{{ category }}</div>
                <div class="tags-wall">
                  <button 
                    v-for="tag in tags" :key="tag.id"
                    class="action-tile-mini"
                    :style="{ '--tile-color': tag.color }"
                    @click="createClip(tag)"
                  >
                    <span class="tile-label">{{ tag.label }}</span>
                  </button>
                </div>
              </div>
            </div>
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
                <Check v-if="lastSavedClipId === clip.id" :size="20" class="text-green-500" />
                <Scissors v-else :size="20" />
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
            <div class="clip-timeline-editor">
              <label>Ajustar duración de clip</label>
              
              <div class="timeline-visual" v-if="duration > 0">
                <div class="track"></div>
                <!-- Context track indicating where the clip is relative to the "zoomed window" -->
                <div class="fill" :style="{
                  left: `${((selectedClip.startTime - clipEditorWindowStart) / (clipEditorWindowEnd - clipEditorWindowStart)) * 100}%`,
                  width: `${((selectedClip.endTime - selectedClip.startTime) / (clipEditorWindowEnd - clipEditorWindowStart)) * 100}%`
                }"></div>
                
                <!-- Start Slider -->
                <input 
                  type="range"
                  class="thumb-slider slider-start"
                  :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.1"
                  :value="selectedClip.startTime"
                  @input="e => updateClipStart(Number((e.target as HTMLInputElement).value))"
                >
                <!-- End Slider -->
                <input 
                  type="range"
                  class="thumb-slider slider-end"
                  :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.1"
                  :value="selectedClip.endTime"
                  @input="e => updateClipEnd(Number((e.target as HTMLInputElement).value))"
                >
              </div>
              <div class="timeline-feedback">
                <span class="t-box" @click="seekTo(selectedClip.startTime)" title="Ir al inicio" style="cursor: pointer">
                  <span>In:</span> {{ formatTime(selectedClip.startTime) }}
                </span>
                
                <button @click="isPreviewing ? stopPreview() : previewClip()" class="btn-preview" :class="{ active: isPreviewing }">
                  <span v-if="isPreviewing"><Loader2 :size="14" class="spin"/> Viendo...</span>
                  <span v-else><PlayCircle :size="14" /> Auto-Play</span>
                </button>
                
                <span class="t-box" @click="seekTo(selectedClip.endTime)" title="Ir al final" style="cursor: pointer">
                  <span>Out:</span> {{ formatTime(selectedClip.endTime) }}
                </span>
              </div>
              
              <!-- Timeline guard -->
              <div v-if="selectedClip.startTime >= selectedClip.endTime" class="error-msg text-red-500 text-xs mt-1">
                El inicio supera al fin.
              </div>
            </div>
            <button @click="handleSave" class="btn-primary full-width" :class="{ 'btn-success': saveStatus === 'saved' }">
              <template v-if="saveStatus === 'saving'">
                <Loader2 :size="18" class="spin" /> Guardando...
              </template>
              <template v-else-if="saveStatus === 'saved'">
                <Check :size="18" /> ¡Guardado con éxito!
              </template>
              <template v-else>
                <Save :size="18" /> Guardar Cambios
              </template>
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
             <div class="form-row" style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input v-model="newTagName" type="text" placeholder="Nombre (Ej: Contra)" class="studio-input" style="flex: 2;">
                <select v-model="newTagCategory" class="studio-input" style="flex: 1;">
                  <option>Defensa</option>
                  <option>Ataque</option>
                  <option>Transiciones</option>
                  <option>BP Ofen.</option>
                  <option>BP Def.</option>
                  <option>Resultado</option>
                </select>
              </div>
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
                @click="analystStore.addTag({ label: newTagName, color: newTagColor, category: newTagCategory, durationBefore: newTagBefore, durationAfter: newTagAfter }); newTagName = ''; isConfiguringTags = false" 
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
  height: calc(100vh - 20px);
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 50% 50%, #1a1f35 0%, #0f121d 100%);
  color: #e2e8f0;
  padding: 10px;
  overflow: hidden;
}

/* Studio Nav */
.studio-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
}

.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.2px;
  color: #94a3b8;
}

.primary-icon {
  color: var(--primary);
  width: 18px;
  height: 18px;
}

/* Layout */
.studio-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
  flex-grow: 1;
  min-height: 0; /* Crucial for nested scroll to work */
  overflow: hidden;
}

.player-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

/* Video Window */
.video-window {
  padding: 8px;
  background: rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  flex: 0 1 auto; /* Flexible but preferred natural size */
  min-height: 0;
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
  padding: 4px 8px 2px;
}

.seeker input {
  width: 100%;
  accent-color: var(--primary);
  margin-bottom: 6px;
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
  width: 38px;
  height: 38px;
  background: var(--primary);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgba(59, 130, 246, 0.3);
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
  transition: color 0.2s;
}

.transport-btn:hover {
  color: white;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid rgba(255,255,255,0.1);
}

.volume-slider {
  width: 60px;
  accent-color: var(--primary);
  opacity: 0.6;
  transition: opacity 0.2s;
  cursor: pointer;
}

.volume-control:hover .volume-slider {
  opacity: 1;
}

.draw-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Integrated Console Logic */
.integrated-console {
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  flex: 1; /* Absorbs remaining space */
  min-height: 180px;
}

.integrated-console .console-body {
  padding: 12px;
  overflow-y: auto !important;
  flex: 1;
  min-height: 0;
}

.integrated-console .groups-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.integrated-console .tag-group {
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(255,255,255,0.03);
}

.integrated-console .group-header {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.integrated-console .tags-wall {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.action-tile-mini {
  background: var(--tile-color);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 4px;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.action-tile-mini:hover {
  filter: brightness(1.2);
  transform: translateY(-1px);
}

.action-tile-mini:active {
  transform: translateY(0);
}

.action-tile-mini .tile-label {
  font-weight: 800;
  font-size: 9px;
  text-transform: uppercase;
  color: white;
  text-shadow: 0 1px 1px rgba(0,0,0,0.4);
}

/* Editor Sidebar */
.editor-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
  z-index: 10;
}

.clips-panel {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.clips-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

/* Hide horizontal scrollbar if any */
.clips-scroll::-webkit-scrollbar-horizontal {
  display: none;
}

.clip-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  user-select: none;
  flex-shrink: 0; /* Prevent clips from getting smaller */
}

.clip-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateX(4px);
}

.clip-card.selected {
  background: rgba(59, 130, 246, 0.12);
  border-color: #3b82f6;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 10px rgba(59, 130, 246, 0.1);
}

.clip-card.selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #3b82f6;
  box-shadow: 2px 0 10px rgba(59, 130, 246, 0.5);
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
  padding: 16px;
  background: rgba(30, 41, 59, 0.4);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  height: 480px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
}

.editor-form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
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
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--primary);
  font-weight: 600;
}

.t-box span {
  color: #94a3b8;
  font-weight: normal;
  margin-right: 4px;
}

/* Timeline Editor */
.clip-timeline-editor {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-primary.btn-success {
  background: #10b981;
}

.full-width {
  width: 100%;
}

.clip-timeline-editor label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.timeline-visual {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  margin: 10px 0;
}

.timeline-visual .track {
  position: absolute;
  left: 0; right: 0;
  height: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.timeline-visual .fill {
  position: absolute;
  height: 8px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  opacity: 1;
  border-radius: 4px;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
  z-index: 5;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.thumb-slider {
  position: absolute;
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  z-index: 10;
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
}

.thumb-slider.slider-end {
  z-index: 11;
}

::-webkit-scrollbar {
  width: 10px; /* Wider for better visibility */
  height: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
  background-clip: padding-box;
}

.thumb-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto;
  width: 14px;
  height: 24px;
  background: var(--primary);
  border: 2px solid white;
  border-radius: 4px;
  cursor: ew-resize;
  box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  transition: transform 0.1s;
}

.thumb-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  background: #60a5fa;
}

.timeline-feedback {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-preview {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-preview:hover {
  background: rgba(16, 185, 129, 0.25);
}

.btn-preview.active {
  background: #10b981;
  color: white;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

/* Modals & Helpers */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(12px);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  padding: 30px;
  display: flex;
  flex-direction: column;
}

.modal-body {
  overflow-y: auto;
  margin-top: 20px;
  padding-right: 10px;
}

.existing-tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 30px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.manage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  border-bottom: none;
}

.manage-row:hover {
  background: rgba(255,255,255,0.06);
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
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.studio-btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
}

.studio-btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.studio-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.studio-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.studio-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
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
::-webkit-scrollbar { width: 6px; height: 0; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }

/* Global reset for 'gray bars' / focus outlines */
button:focus, input:focus, textarea:focus {
  outline: none;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .studio-layout {
    grid-template-columns: 1fr;
    gap: 15px;
    overflow-y: auto;
  }

  .editor-sidebar {
    height: auto;
    max-height: none;
    order: 2;
  }

  .player-container {
    order: 1;
    height: auto;
  }

  .analyst-studio {
    height: auto;
    min-height: 100vh;
    overflow-y: auto;
  }

  .integrated-console {
    height: auto;
    max-height: none;
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .studio-nav {
    flex-wrap: wrap;
    padding: 8px 12px;
    height: auto;
    gap: 8px;
  }

  .brand {
    width: 100%;
    justify-content: center;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 6px;
  }

  .nav-actions {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .studio-btn-primary, .studio-btn-secondary {
    padding: 6px 10px;
    font-size: 11px;
    flex: 1 1 auto;
    justify-content: center;
    min-width: 120px;
  }

  .integrated-console .groups-container {
    grid-template-columns: 1fr;
  }

  .integrated-console .tags-wall {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}

@media (max-width: 480px) {
  .nav-actions {
    flex-direction: column;
  }
  
  .studio-btn-primary, .studio-btn-secondary {
    width: 100%;
  }

  .integrated-console .tags-wall {
    grid-template-columns: 1fr;
  }
}
</style>
