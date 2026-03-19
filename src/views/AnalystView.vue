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
  <div class="h-[calc(100vh-64px)] flex flex-col bg-background text-on-background overflow-hidden relative font-body">
    <!-- Main Toolbar -->
    <nav class="flex items-center justify-between px-6 py-4 bg-surface-container-high/50 backdrop-blur-xl border-b border-primary/15 z-50">
      <div class="flex items-center gap-4 text-primary font-headline font-bold text-lg">
        <Video class="w-6 h-6" />
        <span class="tracking-widest uppercase">Studio Analista v2.0</span>
      </div>
      <div class="flex items-center gap-4">
        <button v-if="!isConsoleExternal" @click="openConsoleWindow" class="px-4 py-2 flex items-center gap-2 bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline" title="Separar Consola">
          <Layout :size="16" /> Ventana Externa
        </button>
        <button v-else @click="isConsoleExternal = false" class="px-4 py-2 flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline hover:bg-primary/30" title="Traer Consola">
          <Layout :size="16" /> Integrar Consola
        </button>
        <button @click="isConfiguringTags = true" class="px-4 py-2 flex items-center gap-2 bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline">
          <Settings2 :size="16" /> Configurar
        </button>
        <button v-if="videoUrl" @click="downloadAllClips" class="px-4 py-2 flex items-center gap-2 bg-primary text-on-primary-container rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline hover:scale-105 shadow-[0_0_15px_rgba(105,246,184,0.3)]" :disabled="isBatchExporting">
          <Download :size="16" />
          {{ isBatchExporting ? `Exportando ${batchProgress.current}/${batchProgress.total}` : 'Exportar Pack (ZIP)' }}
        </button>
      </div>
    </nav>

    <!-- Upload Placeholder -->
    <div v-if="!videoUrl" class="flex-1 flex items-center justify-center p-8 relative">
       <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
       <div class="bg-surface-container-low/80 backdrop-blur border border-white/5 p-12 rounded-3xl text-center max-w-lg shadow-2xl relative z-10 flex flex-col items-center gap-6">
          <div class="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 border-dashed animate-pulse">
            <Video :size="48" />
          </div>
          <h2 class="text-2xl font-black font-headline tracking-tight uppercase text-on-surface">Cargar Video del Partido</h2>
          <p class="text-on-surface-variant text-sm">Formatos admitidos: MP4, MOV, WEBM. Máxima resolución 4K.</p>
          <label class="cursor-pointer bg-primary text-on-primary-container font-headline font-bold text-sm tracking-widest uppercase px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(105,246,184,0.3)] hover:scale-105 transition-all">
            Importar Archivo
            <input type="file" @change="handleVideoUpload" accept="video/*" hidden>
          </label>
       </div>
    </div>

    <!-- Main Workspace -->
    <div v-else class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      <!-- Left Area: Player & Tags -->
      <main class="flex-1 flex flex-col min-w-0 bg-surface-container-lowest border-r border-outline-variant/10 relative">
        <div class="flex-1 relative flex flex-col overflow-hidden bg-black group">
          <div class="flex-1 relative overflow-hidden flex items-center justify-center border-b border-white/10">
            <video 
              ref="videoElement" :src="videoUrl" crossorigin="anonymous"
              @timeupdate="currentTime = ($event.target as HTMLVideoElement).currentTime"
              @loadedmetadata="duration = ($event.target as HTMLVideoElement).duration"
              class="w-full h-full object-contain"
            ></video>
            <DrawingLayer :active="isDrawing" :current-time="currentTime" class="absolute inset-0 pointer-events-none" :style="isDrawing ? 'pointer-events: auto;' : ''" />
          </div>

          <!-- Transport Controls -->
          <div class="h-20 bg-surface-container-low/90 backdrop-blur flex items-center px-6 gap-6 absolute bottom-0 w-full z-[110] opacity-80 group-hover:opacity-100 transition-opacity">
            <div class="flex items-center gap-2">
              <button @click="skipTime(-5)" class="text-on-surface-variant hover:text-primary transition-colors"><RotateCcw :size="20"/></button>
              <button @click="togglePlay" class="w-12 h-12 bg-primary text-on-primary-container rounded-xl flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_15px_rgba(105,246,184,0.3)]">
                <Pause v-if="isPlaying" :size="24" style="fill: currentColor" />
                <Play v-else :size="24" style="fill: currentColor" />
              </button>
              <button @click="skipTime(5)" class="text-on-surface-variant hover:text-primary transition-colors"><RotateCcw :size="20" style="transform: scaleX(-1)"/></button>
            </div>
            
            <div class="flex-1 flex flex-col gap-1 items-center px-4">
              <div class="flex justify-between w-full font-headline text-[10px] text-on-surface-variant uppercase tracking-widest">
                <span>{{ formatTime(currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
              </div>
              <input type="range" class="w-full h-2 rounded-full appearance-none bg-surface-container-highest cursor-pointer accent-primary" :max="duration" step="0.01" :value="currentTime" @input="videoElement!.currentTime = Number(($event.target as HTMLInputElement).value)">
            </div>
            
            <div class="flex items-center gap-4 pl-6 border-l border-white/10">
              <div class="flex items-center gap-2 group/vol relative">
                <button @click="toggleMute" class="text-on-surface-variant hover:text-primary transition-colors"><VolumeX v-if="isMuted || volume === 0" :size="20"/><Volume2 v-else :size="20"/></button>
                <input type="range" class="w-20 h-1.5 appearance-none bg-surface-container-highest rounded-full accent-primary" min="0" max="1" step="0.1" :value="volume" @input="updateVolume(Number(($event.target as HTMLInputElement).value))">
              </div>
              <button @click="isDrawing = !isDrawing" :class="isDrawing ? 'text-primary bg-primary/10' : 'text-on-surface-variant'" class="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Capa de Dibujo"><Pencil :size="20"/></button>
              <button @click="toggleFullscreen" class="p-2 text-on-surface-variant hover:bg-white/5 rounded-lg transition-colors" title="Pantalla Completa"><Maximize :size="20"/></button>
            </div>
          </div>
        </div>

        <!-- Integrated Tags Board -->
        <div v-if="!isConsoleExternal" class="h-48 bg-surface-container border-t border-primary/20 overflow-y-auto p-4 flex gap-4 overflow-x-auto items-start">
          <div v-for="(tags, category) in groupedTags" :key="category" class="flex-shrink-0 w-64 bg-surface-container-low rounded-xl border border-white/5 p-3 flex flex-col gap-2 relative z-10">
            <div class="font-headline text-[10px] uppercase font-bold tracking-widest text-on-surface-variant border-b border-white/5 pb-1 mb-1">{{ category }}</div>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="tag in tags" :key="tag.id" @click="createClip(tag)" :style="{ borderColor: tag.color, color: tag.color }" class="bg-surface-container relative overflow-hidden group border rounded-lg py-2 px-1 hover:bg-white/5 transition-all outline-none active:scale-95 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                <div class="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" :style="{ backgroundColor: tag.color }"></div>
                <span class="relative z-10 text-[9px] font-headline font-black uppercase tracking-widest text-center block truncate">{{ tag.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- Right Area: Clips Sidebar -->
      <aside class="w-full lg:w-[400px] flex flex-col bg-surface-container-low border-l border-white/5 shrink-0 z-10 shadow-2xl">
        <!-- Clips list -->
        <div class="flex-1 flex flex-col min-h-0 border-b border-white/5">
          <div class="p-4 border-b border-white/5 flex justify-between items-center sticky top-0 bg-surface-container-low z-20">
            <h3 class="font-headline font-bold text-sm uppercase tracking-widest text-on-surface flex items-center gap-2"><Scissors :size="16" class="text-primary"/> Recortes</h3>
            <span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-headline font-black">{{ analystStore.clips.length }} TOTAL</span>
          </div>
          
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-for="clip in analystStore.clips" :key="clip.id" 
                @click="selectedClip = clip"
                class="p-3 bg-surface-container rounded-xl border-l-[3px] hover:bg-surface-container-highest transition-all group cursor-pointer border border-white/5 relative"
                :class="[selectedClip?.id === clip.id ? 'border-l-primary shadow-lg bg-surface-container-highest' : 'border-l-transparent', isRecording && processingClipId !== clip.id ? 'opacity-50 pointer-events-none' : '']"
            >
              <div class="flex justify-between items-start mb-2">
                <span class="font-headline text-[10px] uppercase tracking-widest font-bold text-on-surface-variant group-hover:text-primary transition-colors flex items-center gap-1">
                  <Check v-if="lastSavedClipId === clip.id" :size="12" class="text-primary"/> 
                  {{ formatTime(clip.startTime) }}
                </span>
                <span class="font-headline text-[10px] text-outline font-black">{{ (clip.endTime - clip.startTime).toFixed(1) }}s</span>
              </div>
              <p class="text-xs text-on-surface font-medium truncate pr-2">{{ clip.name }}</p>
              
              <div class="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                <button @click.stop="downloadClipAsMP4(clip)" class="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded transition-colors disabled:opacity-50" :disabled="isRecording || isBatchExporting" title="Exportar MP4">
                  <Loader2 v-if="processingClipId === clip.id" :size="14" class="animate-spin" />
                  <Download v-else :size="14" />
                </button>
                <button @click.stop="analystStore.removeClip(clip.id)" class="p-1.5 bg-error/10 text-error hover:bg-error hover:text-white rounded transition-colors" title="Eliminar Clip"><Trash2 :size="14"/></button>
              </div>
            </div>
          </div>
          
          <div v-if="isRecording || isBatchExporting" class="p-4 bg-primary/10 border-t border-primary/20 flex items-center gap-3">
            <Loader2 class="animate-spin text-primary shrink-0" :size="20"/>
            <div>
              <p class="text-[10px] text-primary uppercase font-headline font-bold">Procesando Video</p>
              <p class="text-xs text-on-surface">No cambies de pestaña...</p>
            </div>
            <div class="ml-auto font-headline font-black text-sm text-primary">{{ isBatchExporting ? `${batchProgress.current}/${batchProgress.total}` : `${recordingProgress.toFixed(0)}%` }}</div>
          </div>
        </div>

        <!-- Active Clip Editor Form -->
        <div v-if="selectedClip" class="h-80 lg:min-h-[350px] flex flex-col bg-surface-container border-t-2 border-primary/20 p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-headline text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Pencil :size="14"/> Editor Detalles</h3>
            <button @click="selectedClip = null" class="text-on-surface-variant hover:text-error transition-colors"><X :size="16"/></button>
          </div>
          <div class="flex-1 overflow-y-auto space-y-4">
            <input v-model="selectedClip.name" type="text" class="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Nombre de la jugada">
            <textarea v-model="selectedClip.description" rows="2" class="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" placeholder="Análisis de movimientos..."></textarea>
            
            <div class="bg-surface-container-lowest p-3 rounded-lg border border-white/5">
              <label class="block text-[10px] text-on-surface-variant font-headline uppercase tracking-widest font-bold mb-2">Ajuste de Línea de Tiempo</label>
              <div class="relative h-6 bg-surface-container rounded-sm mb-2 overflow-hidden border border-white/10">
                <div class="absolute inset-y-0 bg-primary/20 pointer-events-none" :style="{ left: `${((selectedClip.startTime - Math.max(0, currentTime-30)) / (Math.min(duration, currentTime+30) - Math.max(0, currentTime-30))) * 100}%`, width: `${((selectedClip.endTime - selectedClip.startTime) / (Math.min(duration, currentTime+30) - Math.max(0, currentTime-30))) * 100}%` }"></div>
                <input type="range" class="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10" :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.1" :value="selectedClip.startTime" @input="e => updateClipStart(Number((e.target as HTMLInputElement).value))">
                <input type="range" class="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-20" :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.1" :value="selectedClip.endTime" @input="e => updateClipEnd(Number((e.target as HTMLInputElement).value))">
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[10px] font-headline bg-white/5 px-2 py-1 rounded cursor-pointer hover:bg-white/10 text-primary transition-all" @click="seekTo(selectedClip!.startTime)">In: {{ formatTime(selectedClip.startTime) }}</span>
                <button @click="isPreviewing ? stopPreview() : previewClip()" class="text-[9px] uppercase font-headline font-bold px-2 py-1 rounded transition-colors flex items-center gap-1" :class="isPreviewing ? 'bg-primary text-on-primary-container' : 'bg-surface-container hover:bg-white/10 text-on-surface'">
                  <Loader2 v-if="isPreviewing" :size="10" class="animate-spin"/>
                  <PlayCircle v-else :size="10"/>
                  {{ isPreviewing ? 'Viendo' : 'Auto' }}
                </button>
                <span class="text-[10px] font-headline bg-white/5 px-2 py-1 rounded cursor-pointer hover:bg-white/10 text-error transition-all" @click="seekTo(selectedClip!.endTime)">Out: {{ formatTime(selectedClip.endTime) }}</span>
              </div>
            </div>
            
            <button @click="handleSave" class="w-full py-2.5 mt-2 rounded-lg font-headline text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2" :class="saveStatus === 'saved' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'bg-surface-container-high border border-white/10 text-on-surface hover:border-primary/30'">
              <Loader2 v-if="saveStatus === 'saving'" :size="14" class="animate-spin" />
              <Check v-else-if="saveStatus === 'saved'" :size="14" />
              <Save v-else :size="14" />
              {{ saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
        <div v-else class="h-80 flex flex-col items-center justify-center bg-surface-container opacity-50 p-6 text-center border-t border-white/5">
          <FileText :size="32" class="text-outline mb-4" />
          <p class="text-xs text-outline font-medium tracking-wide">Selecciona un clip recortado para editar sus notas y detalles tácticos.</p>
        </div>
      </aside>
    </div>

    <!-- Configuration Modal -->
    <div v-if="isConfiguringTags" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div class="bg-surface-container-low border border-white/10 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-container-low">
          <h2 class="font-headline text-lg font-bold tracking-tight text-white uppercase">Gestión de Marcadores</h2>
          <button @click="isConfiguringTags = false" class="text-outline hover:text-error transition-colors"><X :size="20"/></button>
        </div>
        <div class="p-6 space-y-6">
           <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
             <div v-for="tag in analystStore.tags" :key="tag.id" class="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-white/5 group">
               <div class="flex items-center gap-3">
                 <div class="w-4 h-4 rounded-full shadow-inner" :style="{ background: tag.color }"></div>
                 <span class="font-headline text-xs font-bold uppercase tracking-widest text-on-surface">{{ tag.label }}</span>
                 <span class="text-[10px] text-on-surface-variant font-mono bg-white/5 px-2 py-0.5 rounded">{{ tag.durationBefore }}s / {{ tag.durationAfter }}s</span>
               </div>
               <button @click="analystStore.removeTag(tag.id)" class="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"><Trash2 :size="16"/></button>
             </div>
           </div>
           
           <div class="bg-surface-container p-4 rounded-xl border border-white/5 space-y-4">
             <h4 class="font-headline text-xs uppercase text-primary font-bold tracking-widest border-b border-white/5 pb-2">Añadir Nuevo Botón Rapido</h4>
             <div class="flex gap-4">
                <input v-model="newTagName" type="text" placeholder="Nombre (Ej: Contra)" class="flex-[2] bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary">
                <select v-model="newTagCategory" class="flex-[1] bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary">
                  <option>Defensa</option><option>Ataque</option><option>Transiciones</option><option>BP Ofen.</option><option>BP Def.</option><option>Resultado</option>
                </select>
              </div>
             <div class="flex items-end gap-4">
               <div class="flex-1 space-y-1">
                 <label class="text-[10px] uppercase font-headline text-on-surface-variant tracking-widest">Segs Antes</label>
                 <input v-model.number="newTagBefore" type="number" class="w-full bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary">
               </div>
               <div class="flex-1 space-y-1">
                 <label class="text-[10px] uppercase font-headline text-on-surface-variant tracking-widest">Segs Después</label>
                 <input v-model.number="newTagAfter" type="number" class="w-full bg-surface-container-highest border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary">
               </div>
               <div>
                 <input v-model="newTagColor" type="color" class="h-8 w-12 bg-transparent cursor-pointer rounded overflow-hidden">
               </div>
             </div>
             <button @click="analystStore.addTag({ label: newTagName, color: newTagColor, category: newTagCategory, durationBefore: newTagBefore, durationAfter: newTagAfter }); newTagName = ''; isConfiguringTags = false" class="w-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-on-primary-container font-headline font-bold text-[10px] tracking-widest uppercase py-3 rounded-lg transition-colors mt-2">
               Crear Botón
             </button>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>
