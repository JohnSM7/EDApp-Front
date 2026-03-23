<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import {
  Pencil, Trash2, 
  Play, Pause, RotateCcw,
  Volume2, VolumeX, Maximize,
  Move, Minus, MoveUpRight, Circle, Sun, PaintBucket, Eraser,
  Type, Target, Box
} from 'lucide-vue-next'
import DrawingLayer from '../components/DrawingLayer.vue'
import { useAnalystStore } from '../store/analyst'
import { storeToRefs } from 'pinia'

const analystStore = useAnalystStore()
const { drawingTool, drawingColor, isDrawingFilled } = storeToRefs(analystStore)
const videoElement = ref<HTMLVideoElement | null>(null)
const videoUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isDrawing = ref(false)
const activeClipId = ref<string | undefined>(undefined)
const clipName = ref<string>('')
const clipDescription = ref<string>('')
const clipStartTime = ref<number>(0)
const clipEndTime = ref<number>(0)

const videoChannel = new BroadcastChannel('analyst-video')
const playbackRate = ref(1.0)
const drawingLayerRef = ref<any>(null)

// Tactical auto-pause state
const isAutoPaused = ref(false)
let isAutoPausing = false
let autoPauseTimer: ReturnType<typeof setTimeout> | null = null
let lastObservedTime = -1
const recentlyPausedIds = new Set<string>()

const showTitleOverlay = computed(() => {
  if (!activeClipId.value) return false
  return currentTime.value >= clipStartTime.value && currentTime.value <= clipEndTime.value
})

onMounted(() => {
  // Try to retrieve the video URL from the opener window if possible
  if (window.opener && (window.opener as any).syncVideoUrl) {
    videoUrl.value = (window.opener as any).syncVideoUrl
  }

  videoChannel.onmessage = (event) => {
    if (event.data.type === 'PROVIDE_URL') {
      videoUrl.value = event.data.url
    }
    if (event.data.type === 'TOGGLE_PLAY') {
      togglePlay()
    }
    if (event.data.type === 'SEEK' && videoElement.value) {
      videoElement.value.currentTime = event.data.time
    }
    if (event.data.type === 'SPEED' && videoElement.value) {
      playbackRate.value = event.data.rate
      videoElement.value.playbackRate = event.data.rate
    }
    if (event.data.type === 'SELECTED_CLIP') {
      activeClipId.value = event.data.clipId
      if (event.data.clipId) {
         clipName.value = event.data.name || ''
         clipDescription.value = event.data.description || ''
         clipStartTime.value = event.data.startTime || 0
         clipEndTime.value = event.data.endTime || 0
      }
    }
    if (event.data.type === 'SYNC_DRAWING_STATE') {
       isDrawing.value = event.data.isDrawing
       drawingTool.value = event.data.tool
       drawingColor.value = event.data.color
       isDrawingFilled.value = event.data.isFilled
    }
  }

  // If no URL immediately, ask for it
  if (!videoUrl.value) {
    videoChannel.postMessage({ type: 'REQUEST_URL' })
  }
})

onUnmounted(() => {
  videoChannel.postMessage({ type: 'CLOSE' })
  videoChannel.close()
})

watch(playbackRate, (val) => {
  if (videoElement.value) {
    videoElement.value.playbackRate = val
  }
})

const onVideoPlay = () => {
  isPlaying.value = true
  if (isAutoPausing) {
    isAutoPausing = false
    isAutoPaused.value = false
    if (autoPauseTimer) clearTimeout(autoPauseTimer)
  }
  startRafLoop()
}

const onVideoPause = () => {
  isPlaying.value = false
  stopRafLoop()
}

let rafId: number | null = null

const startRafLoop = () => {
  if (!rafId) {
    const loop = () => {
      if (videoElement.value) {
        currentTime.value = videoElement.value.currentTime
        videoChannel.postMessage({ type: 'TIME_UPDATE', time: currentTime.value })
      }
      if (isPlaying.value) {
        
        if (Math.abs(currentTime.value - lastObservedTime) > 1.0) {
           recentlyPausedIds.clear()
        }
        lastObservedTime = currentTime.value

        // --- TACTICAL AUTO-PAUSE LOGIC ---
        if (!isAutoPausing && activeClipId.value) {
           const drawings = analystStore.drawings.filter(d => d.clipId === activeClipId.value || !d.clipId)
           const hitDrawing = drawings.find(d => Math.abs(d.time - currentTime.value) < 0.1 && !recentlyPausedIds.has(d.id || `draw_${d.time}`))
           
           if (hitDrawing) {
              recentlyPausedIds.add(hitDrawing.id || `draw_${hitDrawing.time}`)
              isAutoPausing = true
              isAutoPaused.value = true
              
              if (videoElement.value) {
                 videoElement.value.pause()
                 isPlaying.value = false
              }
              
              if (autoPauseTimer) clearTimeout(autoPauseTimer)
              autoPauseTimer = setTimeout(() => {
                 isAutoPausing = false
                 isAutoPaused.value = false
                 if (activeClipId.value && videoElement.value) {
                    videoElement.value.play().then(() => { isPlaying.value = true }).catch(e => console.error(e))
                 }
              }, 3000)
           }
        }
        
        rafId = requestAnimationFrame(loop)
      } else {
        rafId = null
      }
    }
    rafId = requestAnimationFrame(loop)
  }
}

const stopRafLoop = () => {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// Ensure length changes are synced
const onVideoTimeUpdate = () => {
  if (!isPlaying.value && videoElement.value) {
    currentTime.value = videoElement.value.currentTime
    videoChannel.postMessage({ type: 'TIME_UPDATE', time: currentTime.value })
  }
}

const togglePlay = () => {
  if (!videoElement.value) return
  if (videoElement.value.paused) {
    videoElement.value.play()
  } else {
    videoElement.value.pause()
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
  const wasPlaying = isPlaying.value
  if (wasPlaying) videoElement.value.pause()
  
  let newTime = videoElement.value.currentTime + amount
  if (newTime < 0) newTime = 0
  if (newTime > duration.value) newTime = duration.value
  
  videoElement.value.currentTime = newTime
  currentTime.value = newTime
  videoChannel.postMessage({ type: 'TIME_UPDATE', time: newTime })
  if (wasPlaying) videoElement.value.play()
}

const seekTo = (time: number) => {
  if (!videoElement.value) return
  videoElement.value.currentTime = time
  currentTime.value = time
  videoChannel.postMessage({ type: 'TIME_UPDATE', time: time })
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
  const container = document.querySelector('.video-window')
  if (!container) return

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
}

// Sync drawing state back to main window if changed here
watch([isDrawing, drawingTool, drawingColor, isDrawingFilled], () => {
  videoChannel.postMessage({
    type: 'SYNC_DRAWING_STATE',
    isDrawing: isDrawing.value,
    tool: drawingTool.value,
    color: drawingColor.value,
    isFilled: isDrawingFilled.value
  })
})


</script>

<template>
  <div class="video-only-studio">
    <div v-if="!videoUrl" class="loading-state">
      <h3>Sincronizando vídeo con ventana principal...</h3>
    </div>
    
    <div v-else class="video-window relative flex">
      <!-- Drawing Tools Sidebar (LEFT) -->
      <transition name="slide-left">
        <div v-if="isDrawing" class="w-20 bg-[#0f121d] border-r border-white/5 flex flex-col items-center py-4 gap-3 z-50 shrink-0 shadow-2xl overflow-y-auto scrollbar-none">
          <div class="grid grid-cols-2 gap-2 px-2 w-full justify-items-center">
            <button @click="drawingTool = 'select'" :class="drawingTool === 'select' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Move class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'pencil'" :class="drawingTool === 'pencil' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Pencil class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'line'" :class="drawingTool === 'line' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Minus class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'arrow'" :class="drawingTool === 'arrow' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <MoveUpRight class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'poly'" :class="drawingTool === 'poly' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Box class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'text'" :class="drawingTool === 'text' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Type class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'circle'" :class="drawingTool === 'circle' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Circle class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'marker'" :class="drawingTool === 'marker' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Target class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'spotlight'" :class="drawingTool === 'spotlight' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Sun class="w-4 h-4" stroke-width="2.5" />
            </button>
            <button @click="drawingTool = 'eraser'" :class="drawingTool === 'eraser' ? 'bg-red-500 text-white shadow-lg' : 'text-red-400/60 hover:bg-red-500/10' " class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shrink-0">
              <Eraser class="w-4 h-4" stroke-width="2.5" />
            </button>
          </div>
          <div class="h-px bg-white/5 w-10 mx-auto"></div>
          <div class="grid grid-cols-2 gap-2 px-2 w-full justify-items-center">
            <button @click="isDrawingFilled = !isDrawingFilled" :class="isDrawingFilled ? 'bg-primary/20 text-primary ring-1 ring-primary/30' : 'text-slate-400 hover:bg-white/10'" class="w-8 h-8 rounded-lg transition-all flex items-center justify-center shadow-lg">
              <PaintBucket class="w-4 h-4" stroke-width="2.5" />
            </button>
            <div class="grid grid-cols-2 gap-1 items-center">
               <div @click="drawingColor = '#10b981'" class="w-3 h-3 rounded-full cursor-pointer" :class="{'ring-2 ring-white': drawingColor === '#10b981'}" style="background: #10b981"></div>
               <div @click="drawingColor = '#ef4444'" class="w-3 h-3 rounded-full cursor-pointer" :class="{'ring-2 ring-white': drawingColor === '#ef4444'}" style="background: #ef4444"></div>
               <div @click="drawingColor = '#3b82f6'" class="w-3 h-3 rounded-full cursor-pointer" :class="{'ring-2 ring-white': drawingColor === '#3b82f6'}" style="background: #3b82f6"></div>
               <div @click="drawingColor = '#ffeb3b'" class="w-3 h-3 rounded-full cursor-pointer" :class="{'ring-2 ring-white': drawingColor === '#ffeb3b'}" style="background: #ffeb3b"></div>
            </div>
          </div>
          <button @click="drawingLayerRef?.clearFrame()" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center shrink-0 mt-auto">
            <Trash2 class="w-4 h-4" stroke-width="2.5" />
          </button>
        </div>
      </transition>

      <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-black relative">
        <div class="flex-1 relative flex items-center justify-center overflow-hidden">
          <video 
            ref="videoElement" 
            :src="videoUrl" 
            class="max-w-full max-h-full object-contain"
            @timeupdate="onVideoTimeUpdate"
            @loadedmetadata="duration = videoElement!.duration; videoChannel.postMessage({ type: 'DURATION_UPDATE', duration: duration })"
            @play="onVideoPlay"
            @pause="onVideoPause"
          ></video>
          <DrawingLayer ref="drawingLayerRef" :active="isDrawing" :current-time="currentTime" :active-clip-id="activeClipId" class="absolute inset-0" :style="isDrawing ? 'pointer-events: auto;' : 'pointer-events: none;'" />

          <!-- Title Overlay -->
          <transition name="fade">
             <div v-if="activeClipId && showTitleOverlay" class="absolute bottom-12 left-6 right-6 z-30 pointer-events-none flex flex-col items-center">
                <div class="bg-black/40 backdrop-blur-xl border-l-[4px] border-primary px-6 py-4 rounded-xl shadow-2xl">
                  <h2 class="text-xl md:text-3xl font-headline font-black uppercase tracking-widest text-white text-center">{{ clipName }}</h2>
                  <p v-if="clipDescription" class="text-sm text-slate-400 mt-1 font-medium text-center">{{ clipDescription }}</p>
                </div>
             </div>
          </transition>
              
          <!-- Tactical Auto-pause indicator -->
          <transition name="fade">
             <div v-if="isAutoPaused" class="absolute top-8 left-1/2 -translate-x-1/2 z-40">
                <div class="bg-red-500/90 text-white font-headline uppercase font-black tracking-[0.2em] text-[10px] px-6 py-2 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-white/20 animate-pulse backdrop-blur-md">
                   Pausa Táctica (3s)
                </div>
             </div>
          </transition>
        </div>

        <!-- NEW PREMIUM TRANSPORT BAR -->
        <div class="h-14 bg-[#0f172a] border-t border-white/10 flex flex-col px-4 z-[120] shrink-0">
          <!-- Timeline -->
          <div class="w-full flex flex-col py-1">
             <div class="flex justify-between w-full text-[8px] font-headline font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                <span>{{ formatTime(currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
             </div>
             <input type="range" class="w-full h-1 rounded-full appearance-none bg-slate-800 cursor-pointer accent-primary" :max="duration" step="0.01" :value="currentTime" @input="seekTo(Number(($event.target as HTMLInputElement).value))">
          </div>

          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center gap-3">
              <button @click="skipTime(-5)" class="text-slate-400 hover:text-primary transition-colors"><RotateCcw :size="14"/></button>
              <button @click="togglePlay" class="w-8 h-8 bg-primary text-[#0f172a] rounded-lg flex items-center justify-center hover:scale-105 transition-all shadow-lg">
                <Pause v-if="isPlaying" :size="18" style="fill: currentColor" />
                <Play v-else :size="18" style="fill: currentColor" />
              </button>
              <button @click="skipTime(5)" class="text-slate-400 hover:text-primary transition-colors"><RotateCcw :size="14" style="transform: scaleX(-1)"/></button>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <button @click="toggleMute" class="text-slate-400 hover:text-primary transition-colors"><VolumeX v-if="isMuted || volume === 0" :size="16"/><Volume2 v-else :size="16"/></button>
                <input type="range" class="w-20 h-0.5 appearance-none bg-slate-800 rounded-full accent-primary" min="0" max="1" step="0.1" :value="volume" @input="updateVolume(Number(($event.target as HTMLInputElement).value))">
              </div>

              <div class="h-4 w-px bg-white/10 mx-1"></div>

              <select v-model="playbackRate" class="bg-transparent text-[10px] font-bold text-slate-300 hover:text-primary outline-none cursor-pointer appearance-none px-2 uppercase tracking-tighter">
                <option :value="0.5">x0.5</option>
                <option :value="1">x1.0</option>
                <option :value="2">x2.0</option>
                <option :value="5">x5.0</option>
              </select>

              <button @click="isDrawing = !isDrawing" :disabled="!activeClipId" :class="[isDrawing ? 'text-primary bg-primary/10' : 'text-slate-400', !activeClipId ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5']" class="p-1.5 rounded-lg transition-all">
                <Pencil :size="16"/>
              </button>
              <button @click="toggleFullscreen" class="p-1.5 text-slate-400 hover:bg-white/5 rounded-lg transition-colors"><Maximize :size="16"/></button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.video-only-studio {
  height: 100vh;
  display: flex;
  background: #090b11;
  color: white;
  overflow: hidden;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #64748b;
  font-family: inherit;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.video-window {
  flex: 1;
  display: flex;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Range input styling for a premium look */
input[type=range] {
  -webkit-appearance: none;
  background: transparent;
}
input[type=range]:focus {
  outline: none;
}
input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}
input[type=range]::-webkit-slider-thumb {
  height: 12px;
  width: 12px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  -webkit-appearance: none;
  margin-top: -4px;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}
</style>
