<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import {
  Play, Pause, RotateCcw, Pencil,
  Volume2, VolumeX, Maximize
} from 'lucide-vue-next'
import DrawingLayer from '../components/DrawingLayer.vue'
import { useAnalystStore } from '../store/analyst'

const analystStore = useAnalystStore()
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
  // Go full screen with the entire window container to keep controls visible
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
</script>

<template>
  <div class="video-only-studio">
    <div v-if="!videoUrl" class="loading-state">
      <h3>Sincronizando vídeo con ventana principal...</h3>
    </div>
    
    <div v-else class="video-window">
      <div class="video-frame glass-card">
        <video 
          ref="videoElement" 
          :src="videoUrl" 
          class="main-video"
          @timeupdate="onVideoTimeUpdate"
          @loadedmetadata="duration = videoElement!.duration; videoChannel.postMessage({ type: 'DURATION_UPDATE', duration: duration })"
          @play="onVideoPlay"
          @pause="onVideoPause"
          @click="togglePlay"
        ></video>
        <DrawingLayer :active="isDrawing" :current-time="currentTime" :active-clip-id="activeClipId" class="absolute inset-0 pointer-events-none" :style="isDrawing ? 'pointer-events: auto;' : ''" />

        <!-- Title Overlay -->
        <transition name="fade">
           <div v-if="activeClipId && showTitleOverlay" class="absolute bottom-16 left-8 right-8 z-30 pointer-events-none flex flex-col items-center">
              <div class="bg-surface-container-highest/90 backdrop-blur-xl border-l-[4px] border-primary px-6 py-4 rounded-xl shadow-2xl transform transition-transform">
                <h2 class="text-xl md:text-3xl font-headline font-black uppercase tracking-widest text-white shadow-black drop-shadow-md text-center">{{ clipName }}</h2>
                <p v-if="clipDescription" class="text-sm text-tertiary mt-1 font-medium text-center">{{ clipDescription }}</p>
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

      <div class="transport-bar">
        <div class="seeker">
          <input 
            type="range" :max="duration" step="0.01" :value="currentTime"
            @input="seekTo(Number(($event.target as HTMLInputElement).value))"
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
          </div>
          <div class="time-readout">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
          <div class="audio-controls">
            <button @click="toggleMute" class="transport-btn">
              <VolumeX v-if="isMuted || volume === 0" :size="18" />
              <Volume2 v-else :size="18" />
            </button>
            <input 
              type="range" min="0" max="1" step="0.05" :value="isMuted ? 0 : volume"
              @input="updateVolume(Number(($event.target as HTMLInputElement).value))"
              class="volume-slider"
            >
            <select v-model="playbackRate" class="bg-transparent text-[10px] font-bold text-on-surface hover:text-primary outline-none cursor-pointer hidden md:block">
              <option :value="0.5">x0.5</option>
              <option :value="1">x1.0</option>
              <option :value="2">x2.0</option>
              <option :value="5">x5.0</option>
            </select>
            <button @click="isDrawing = !isDrawing" :class="[isDrawing ? 'text-primary' : '', !activeClipId ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5']" class="transport-btn bg-transparent" style="margin-left: 10px;" :disabled="!activeClipId" :title="activeClipId ? 'Capa de Dibujo' : 'Selecciona un Recorte Primero'">
              <Pencil :size="18" />
            </button>
            <button @click="toggleFullscreen" class="transport-btn fullscreen-btn ml-2"><Maximize :size="18" /></button>
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
  background: #0f121d;
  color: white;
  padding: 10px;
  box-sizing: border-box;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #94a3b8;
}

.video-window {
  flex: 1;
  background: rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
}

.video-frame {
  flex: 1;
  position: relative;
  background: #000;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.main-video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.transport-bar {
  padding: 2px 10px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 0 0 8px 8px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.seeker input {
  width: 100%;
  accent-color: var(--primary);
  margin-bottom: 2px;
  height: 12px;
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
  width: 24px;
  height: 24px;
  background: var(--primary);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transport-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.volume-slider {
  width: 40px;
  accent-color: var(--primary);
}

.time-readout {
  font-family: monospace;
  font-size: 10px;
  color: #e2e8f0;
}
</style>
