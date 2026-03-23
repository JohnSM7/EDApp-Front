<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { 
  Video, Scissors, Pencil, Trash2, 
  Download, Play, Pause, RotateCcw, Settings2,
  X, Save, Layout, FileText, Loader2, PlayCircle, Check,
  Volume2, VolumeX, Maximize,
  Move, Minus, MoveUpRight, Circle, Square, Triangle, Sun, PaintBucket, Eraser,
  Route, Ruler, Type, Target, Box, Navigation
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAnalystStore, type Clip } from '../store/analyst'
import { useAuthStore } from '../store/auth'
import DrawingLayer from '../components/DrawingLayer.vue'
import JSZip from 'jszip'
import { recordVideoSegment } from '../utils/videoExport'

const analystStore = useAnalystStore()
const { drawingTool, drawingColor, isDrawingFilled } = storeToRefs(analystStore)
const authStore = useAuthStore()
const user = computed(() => authStore.user)
const videoElement = ref<HTMLVideoElement | null>(null)
const videoUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)

// Video wrapper sizing (drives the drawing layer alignment)
const videoOuterContainerRef = ref<HTMLElement | null>(null)
const videoWrapperStyle = ref({ width: '100%', height: '100%' })
let videoWrapperResizeObserver: ResizeObserver | null = null

const updateVideoWrapper = () => {
  const outer = videoOuterContainerRef.value
  const video = videoElement.value
  if (!outer || !video || !video.videoWidth) return

  const containerW = outer.clientWidth
  const containerH = outer.clientHeight
  if (!containerW || !containerH) return

  const ratio = video.videoWidth / video.videoHeight
  let w = containerW
  let h = containerH

  if (w / h > ratio) {
    w = Math.round(h * ratio)
  } else {
    h = Math.round(w / ratio)
  }

  videoWrapperStyle.value = { width: `${w}px`, height: `${h}px` }
}

// Workspace States
const isDrawing = ref(false)
const isConfiguringTags = ref(false)
const drawingLayerRef = ref<any>(null)
const fullscreenWrapperRef = ref<HTMLElement | null>(null)
const selectedClip = ref<Clip | null>(null)
const titleDismissed = ref(false)
const isConsoleExternal = ref(false)
const isVideoExternal = ref(false)
const processingClipId = ref<string | null>(null)
const recordingProgress = ref(0)
const isRecording = ref(false)
const batchProgress = ref({ current: 0, total: 0 })
const isBatchExporting = ref(false)
const clipFilterTag = ref<string>('all')

// Filtered clips list
const filteredClips = computed(() => {
  if (clipFilterTag.value === 'all') return analystStore.currentMatchClips
  return analystStore.currentMatchClips.filter(clip => {
    const tag = analystStore.tags.find(t => t.id === clip.tagId)
    return tag && tag.label === clipFilterTag.value
  })
})

const uniqueClipTags = computed(() => {
  const titles = new Set<string>()
  analystStore.currentMatchClips.forEach(clip => {
    const tag = analystStore.tags.find(t => t.id === clip.tagId)
    if (tag) titles.add(tag.label)
  })
  return Array.from(titles).sort()
})

// Window communication
const consoleChannel = new BroadcastChannel('analyst-console')

onMounted(() => {
  nextTick(() => {
    if (videoOuterContainerRef.value) {
      videoWrapperResizeObserver = new ResizeObserver(() => requestAnimationFrame(updateVideoWrapper))
      videoWrapperResizeObserver.observe(videoOuterContainerRef.value)
    }
  })
  document.addEventListener('fullscreenchange', () => setTimeout(updateVideoWrapper, 150))
  window.addEventListener('resize', updateVideoWrapper)
})

onUnmounted(() => {
  videoWrapperResizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', updateVideoWrapper)
  window.removeEventListener('resize', updateVideoWrapper)
})

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

// Video window communication
const videoChannel = new BroadcastChannel('analyst-video')

const playbackRate = ref(1.0)
watch(playbackRate, (val) => {
  if (videoElement.value) {
    videoElement.value.playbackRate = val
  }
  if (isVideoExternal.value) {
    videoChannel.postMessage({ type: 'SPEED', rate: val })
  }
})

const openVideoWindow = () => {
  const width = 1000
  const height = 650
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  
  // Make URL available globally for the child window
  ;(window as any).syncVideoUrl = videoUrl.value
  
  isVideoExternal.value = true
  
  const videoWin = window.open(
    '/analyst/video', 
    'TacticalVideo', 
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  )

  const checkClosed = setInterval(() => {
    if (videoWin?.closed) {
      isVideoExternal.value = false
      clearInterval(checkClosed)
    }
  }, 1000)
}

videoChannel.onmessage = (event) => {
  if (event.data.type === 'REQUEST_URL') {
    videoChannel.postMessage({ type: 'PROVIDE_URL', url: videoUrl.value })
    if (selectedClip.value) {
      videoChannel.postMessage({ 
        type: 'SELECTED_CLIP', 
        clipId: selectedClip.value.id, 
        name: selectedClip.value.name, 
        description: selectedClip.value.description, 
        startTime: selectedClip.value.startTime,
        endTime: selectedClip.value.endTime
      })
    } else {
      videoChannel.postMessage({ type: 'SELECTED_CLIP', clipId: undefined })
    }
  }
  if (event.data.type === 'TIME_UPDATE') {
    currentTime.value = event.data.time
  }
  if (event.data.type === 'DURATION_UPDATE') {
    duration.value = event.data.duration
  }
  if (event.data.type === 'CLOSE') {
    isVideoExternal.value = false
  }
  if (event.data.type === 'SYNC_DRAWING_STATE') {
    isDrawing.value = event.data.isDrawing
    drawingTool.value = event.data.tool
    drawingColor.value = event.data.color
    isDrawingFilled.value = event.data.isFilled
  }
}

watch([isPlaying, volume, isMuted], ([newIsPlaying, newVolume, newIsMuted]) => {
  consoleChannel.postMessage({
    type: 'STATE_UPDATE',
    state: { isPlaying: newIsPlaying, volume: newVolume, isMuted: newIsMuted }
  })
})

watch(selectedClip, (newClip) => {
  if (isVideoExternal.value) {
    videoChannel.postMessage({ type: 'SELECTED_CLIP', clipId: newClip?.id })
    // Sync title/desc too for the external overlay
    if (newClip) {
       videoChannel.postMessage({ 
         type: 'SELECTED_CLIP', 
         clipId: newClip.id, 
         name: newClip.name, 
         description: newClip.description, 
         startTime: newClip.startTime,
         endTime: newClip.endTime
       })
    }
  }
})

// Sync drawing state to external window
watch([isDrawing, drawingTool, drawingColor, isDrawingFilled], () => {
  if (isVideoExternal.value) {
    videoChannel.postMessage({
      type: 'SYNC_DRAWING_STATE',
      isDrawing: isDrawing.value,
      tool: drawingTool.value,
      color: drawingColor.value,
      isFilled: isDrawingFilled.value
    })
  }
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

const editorStartPercent = computed(() => {
  if (!selectedClip.value) return 0
  const total = clipEditorWindowEnd.value - clipEditorWindowStart.value
  if (total <= 0) return 0
  return ((selectedClip.value.startTime - clipEditorWindowStart.value) / total) * 100
})
const editorWidthPercent = computed(() => {
  if (!selectedClip.value) return 0
  const total = clipEditorWindowEnd.value - clipEditorWindowStart.value
  if (total <= 0) return 0
  return ((selectedClip.value.endTime - selectedClip.value.startTime) / total) * 100
})
const editorCurrentPercent = computed(() => {
  const total = clipEditorWindowEnd.value - clipEditorWindowStart.value
  if (total <= 0) return 0
  return ((currentTime.value - clipEditorWindowStart.value) / total) * 100
})

const editorTimelineRef = ref<HTMLElement | null>(null)
const isEditorScrubbing = ref(false)

const handleEditorTimelineMouseMove = (e: MouseEvent) => {
  if (!isEditorScrubbing.value || !editorTimelineRef.value || !videoElement.value) return
  
  const rect = editorTimelineRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const percent = x / rect.width
  const total = clipEditorWindowEnd.value - clipEditorWindowStart.value
  const time = clipEditorWindowStart.value + (percent * total)
  
  videoElement.value.currentTime = time
  if (!isPlaying.value) currentTime.value = time
}

const handleEditorTimelineMouseUp = () => {
  if (isEditorScrubbing.value) {
    isEditorScrubbing.value = false
    document.removeEventListener('mousemove', handleEditorTimelineMouseMove)
    document.removeEventListener('mouseup', handleEditorTimelineMouseUp)
  }
}

const handleEditorTimelineMouseDown = (e: MouseEvent) => {
  e.preventDefault() // prevent accidental drag selections
  isEditorScrubbing.value = true
  document.addEventListener('mousemove', handleEditorTimelineMouseMove)
  document.addEventListener('mouseup', handleEditorTimelineMouseUp)
}

// Preview state
const isPreviewing = ref(false)
let previewInterval: ReturnType<typeof setInterval> | null = null

// Tactical auto-pause state
const isAutoPaused = ref(false)
let isAutoPausing = false
let autoPauseTimer: ReturnType<typeof setTimeout> | null = null
let lastObservedTime = -1
const recentlyPausedIds = new Set<string>()

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
        if (isVideoExternal.value) {
           videoChannel.postMessage({ 
             type: 'SELECTED_CLIP', 
             clipId: newClip.id, 
             name: newClip.name, 
             description: newClip.description, 
             startTime: newClip.startTime,
             endTime: newClip.endTime
           })
        }
      }
    }, 100)
  } else {
    if (isVideoExternal.value) {
      videoChannel.postMessage({ type: 'SELECTED_CLIP', clipId: undefined })
    }
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
  if (rafId) cancelAnimationFrame(rafId)
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

// Tactical auto-pause indicator computing
const currentRenderClipId = computed(() => processingClipId.value || selectedClip.value?.id)

const showTitleOverlay = computed(() => {
  if (!selectedClip.value) return false
  // Show during the ENTIRE clip duration
  return currentTime.value >= selectedClip.value.startTime && currentTime.value <= selectedClip.value.endTime
})

// Reset titleDismissed when switching clips
watch(selectedClip, () => { titleDismissed.value = false })

// Delete clip + its title + deselect
const deleteClip = (clipId: string) => {
  if (selectedClip.value?.id === clipId) {
    selectedClip.value = null
    titleDismissed.value = true
  }
  analystStore.removeClip(clipId)
}

const tacticalPauses = computed(() => {
  if (!selectedClip.value) return []
  const windowStart = clipEditorWindowStart.value
  const windowLength = clipEditorWindowEnd.value - windowStart
  
  if (windowLength <= 0) return []
  
  const drawings = analystStore.drawings.filter(d => d.clipId === selectedClip.value!.id)
  const pauses: { time: number, percent: number }[] = []
  
  drawings.forEach(d => {
     if (!pauses.some(p => Math.abs(p.time - d.time) < 1.0)) {
       pauses.push({
          time: d.time,
          percent: ((d.time - windowStart) / windowLength) * 100
       })
     }
  })
  return pauses.filter(p => p.percent >= 0 && p.percent <= 100)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = ''
})

const editingMatchTitle = ref(false)
const matchTitleInput = ref('')
const pendingResumeMatchId = ref<string | null>(null)

// Autosave indicator
const autoSaveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(() => analystStore.clips.length + analystStore.drawings.length, () => {
  autoSaveStatus.value = 'saving'
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    analystStore.saveToStorage()
    autoSaveStatus.value = 'saved'
    setTimeout(() => { autoSaveStatus.value = 'idle' }, 2000)
  }, 800)
})

const handleVideoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = URL.createObjectURL(file)

  // If resuming a known match, activate it. Otherwise load/create.
  if (pendingResumeMatchId.value) {
    analystStore.currentMatchId = pendingResumeMatchId.value
    pendingResumeMatchId.value = null
  } else {
    const match = analystStore.loadOrCreateMatch(file.name, file.size)
    matchTitleInput.value = match.title
  }

  drawingLayerRef.value?.clearHistoryStack()
  selectedClip.value = null
  currentTime.value = 0
  titleDismissed.value = false
}

/** Resume an existing match — asks user to locate the video file */
const resumeMatch = (match: { id: string; title: string }) => {
  pendingResumeMatchId.value = match.id
  analystStore.currentMatchId = match.id
  // Programmatically trigger file input
  const input = document.getElementById('resumeFileInput') as HTMLInputElement
  if (input) input.click()
}

let rafId: number | null = null

const startRafLoop = () => {
  if (!rafId) {
    const loop = () => {
      if (videoElement.value) {
        currentTime.value = videoElement.value.currentTime
        if (playbackRate.value !== videoElement.value.playbackRate) {
           videoElement.value.playbackRate = playbackRate.value // enforce speed
        }
        if (isVideoExternal.value) {
          videoChannel.postMessage({ type: 'TIME_UPDATE', time: currentTime.value })
        }
      }
      if (isPlaying.value || isVideoExternal.value) {
        
        if (Math.abs(currentTime.value - lastObservedTime) > 1.0) {
           // User performed a manual sweep or skip: reset pause queue
           recentlyPausedIds.clear()
        }
        lastObservedTime = currentTime.value

        // --- TACTICAL AUTO-PAUSE LOGIC ---
        const activeId = processingClipId.value || selectedClip.value?.id
        // We now ALLOW pausing during recording/exporting because the user wants it in the final file
        if (isPlaying.value && !isAutoPausing) {
           // If we have an activeId, stay within that clip's drawings + global ones. Otherwise, consider all.
           const drawings = activeId 
              ? analystStore.drawings.filter(d => d.clipId === activeId || !d.clipId)
              : analystStore.drawings;

           const timeThreshold = 0.1
           
           // Group drawings near current time
           const drawingsAtThisTime = drawings.filter(d => Math.abs(d.time - currentTime.value) < timeThreshold)
           const hitDrawing = drawingsAtThisTime.find(d => !recentlyPausedIds.has(d.id || `draw_${d.time}`))
           
           if (hitDrawing) {
              // Mark ALL drawings in this time window as 'paused' to avoid double-pausing
              drawingsAtThisTime.forEach(d => recentlyPausedIds.add(d.id || `draw_${d.time}`))
              
              isAutoPausing = true
              isAutoPaused.value = true
              
              if (videoElement.value) {
                 videoElement.value.pause()
                 isPlaying.value = false 
              }
              
              if (autoPauseTimer) clearTimeout(autoPauseTimer)
              autoPauseTimer = setTimeout(() => {
                 if (isAutoPaused.value && videoElement.value) {
                    isAutoPausing = false
                    isAutoPaused.value = false
                    videoElement.value.play().then(() => { 
                       isPlaying.value = true 
                    }).catch(e => console.error("Resume failed:", e))
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

const onVideoPlay = () => {
  isPlaying.value = true
  if (isAutoPausing) {
    // User overrode the tactical pause by manually playing
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

const togglePlay = () => {
  if (isVideoExternal.value) {
    videoChannel.postMessage({ type: 'TOGGLE_PLAY' })
    isPlaying.value = !isPlaying.value
    return
  }
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

const formatTimeDigits = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

const updateTimeFromDigits = (clip: Clip, field: 'startTime' | 'endTime', value: string) => {
  try {
     const parts = value.split(':')
     if (parts.length !== 2) return
     
     const minutes = parseInt(parts[0] ?? '0')
     const secondsFull = parts[1] ?? '0'
     const secondsParts = secondsFull.split('.')
     const seconds = parseInt(secondsParts[0] ?? '0')
     const ms = secondsParts.length > 1 ? parseInt(secondsParts[1] ?? '0') : 0
     
     if (isNaN(minutes) || isNaN(seconds)) return
     
     const totalSeconds = minutes * 60 + seconds + (ms / 10)
     
     if (field === 'startTime') {
       clip.startTime = Math.max(0, Math.min(totalSeconds, clip.endTime - 0.1))
     } else {
       clip.endTime = Math.min(duration.value || 9999, Math.max(totalSeconds, clip.startTime + 0.1))
     }
  } catch (e) {
     console.error("Error parsing time input", e)
  }
}

const skipTime = (amount: number) => {
  if (!videoElement.value) return
  // Pause if it was playing to prevent erratic behavior when jumping quickly
  const wasPlaying = isPlaying.value
  if (wasPlaying) videoElement.value.pause()
  
  let newTime = videoElement.value.currentTime + amount
  if (newTime < 0) newTime = 0
  if (newTime > duration.value) newTime = duration.value
  
  if (isVideoExternal.value) {
    videoChannel.postMessage({ type: 'SEEK', time: newTime })
    currentTime.value = newTime
    if (wasPlaying) {
      isPlaying.value = true
      videoChannel.postMessage({ type: 'TOGGLE_PLAY' })
    }
    return
  }
  
  videoElement.value.currentTime = newTime
  currentTime.value = newTime
  
  if (wasPlaying) videoElement.value.play()
}

const seekTo = (time: number) => {
  if (isVideoExternal.value) {
    videoChannel.postMessage({ type: 'SEEK', time })
    currentTime.value = time
    return
  }
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
  const container = fullscreenWrapperRef.value || videoElement.value.parentElement
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
    matchId: analystStore.currentMatchId || 'legacy',
    videoUrl: videoUrl.value!,
    notes: '',
    description: ''
  })

  clipStart.value = null
  clipEnd.value = null

  // Auto-select the new clip and seek to its start so user can review immediately
  const matchClips = analystStore.currentMatchClips
  const newClip = matchClips[matchClips.length - 1]
  if (newClip) {
    selectedClip.value = newClip
    seekTo(start!)
    titleDismissed.value = false
  }
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

const setInPoint = () => {
  if (!selectedClip.value) return
  updateClipStart(currentTime.value)
}

const setOutPoint = () => {
  if (!selectedClip.value) return
  updateClipEnd(currentTime.value)
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
    const clipInfo = { name: clip.name, description: clip.description }
    const overlayCanvas = drawingLayerRef.value?.getCanvasElement() || null
    const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime, overlayCanvas, clipInfo)
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
        const clipInfo = { name: clip.name, description: clip.description }
        
        // Force the DrawingLayer to render this specific clip during batch export
        processingClipId.value = clip.id
        // Wait a tick for bindings to apply
        await new Promise(r => setTimeout(r, 50))
        
        const overlayCanvas = drawingLayerRef.value?.getCanvasElement() || null
        const { blob, extension } = await recordVideoSegment(videoElement.value, clip.startTime, clip.endTime, overlayCanvas, clipInfo)
        
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
      end: c.endTime,
      id: c.id
    }))

    const projectData = {
      project_name: 'Análisis Táctico EDApp',
      export_date: new Date().toISOString(),
      clips: manifest,
      drawings: analystStore.drawings // KlipDraw data attached
    }

    zip.file('analisis_tactico_edapp.json', JSON.stringify(projectData, null, 2))

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

// No longer wipe data on close — match data is persisted in localStorage
const closeVideo = () => {
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = null
  selectedClip.value = null
  currentTime.value = 0
  analystStore.currentMatchId = null
  stopPreview()
}
</script>

<template>
  <div style="height: calc(100vh - 128px); max-height: calc(100vh - 128px);" class="w-full flex flex-col bg-background text-on-background overflow-hidden relative font-body rounded-2xl shadow-2xl border border-white/5">
    <!-- Main Toolbar -->
    <nav class="flex items-center justify-between px-6 py-4 bg-surface-container-high/50 backdrop-blur-xl border-b border-primary/15 z-50">
      <div class="flex items-center gap-4 text-primary font-headline font-bold text-lg">
        <Video class="w-6 h-6" />
        <span class="tracking-widest uppercase text-sm">Studio Analista</span>
        
        <!-- Editable match title -->
        <template v-if="analystStore.currentMatch">
          <span class="text-white/20">|</span>
          <div v-if="!editingMatchTitle" @click="editingMatchTitle = true; matchTitleInput = analystStore.currentMatch.title" class="flex items-center gap-2 cursor-pointer group">
            <span class="text-on-surface font-headline font-bold text-sm tracking-wide group-hover:text-primary transition-colors">{{ analystStore.currentMatch.title }}</span>
            <Pencil :size="12" class="text-on-surface-variant group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
          </div>
          <div v-else class="flex items-center gap-2">
            <input v-model="matchTitleInput" @blur="analystStore.updateMatchTitle(analystStore.currentMatch.id, matchTitleInput); editingMatchTitle = false" @keyup.enter="analystStore.updateMatchTitle(analystStore.currentMatch.id, matchTitleInput); editingMatchTitle = false" @keyup.esc="editingMatchTitle = false" class="bg-surface-container-low border border-primary/30 rounded-lg px-3 py-1 text-sm text-on-surface outline-none focus:border-primary font-headline" autofocus />
          </div>
        </template>

        <button v-if="videoUrl" @click="closeVideo" class="ml-4 px-3 py-1.5 flex items-center gap-2 bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 rounded-lg transition-all uppercase tracking-widest text-[10px] font-bold font-headline" title="Cerrar Vídeo Actual">
          <X :size="14" /> Cerrar Vídeo
        </button>
      </div>
      <div class="flex items-center gap-3">
        <!-- User info -->
        <div v-if="user" class="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-xl border border-white/5">
          <div class="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-headline font-black">{{ user.name[0]?.toUpperCase() }}</div>
          <span class="text-xs text-on-surface-variant font-medium hidden md:block">{{ user.name }}</span>
          <span class="text-[9px] text-primary/60 uppercase font-headline font-bold px-1 py-0.5 bg-primary/10 rounded">{{ user.role }}</span>
        </div>
        <!-- Autosave indicator -->
        <transition name="fade">
          <div v-if="videoUrl && autoSaveStatus !== 'idle'" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-headline font-bold uppercase tracking-widest"
            :class="autoSaveStatus === 'saving' ? 'text-on-surface-variant' : 'text-primary'">
            <Loader2 v-if="autoSaveStatus === 'saving'" :size="12" class="animate-spin" />
            <Check v-else :size="12" />
            {{ autoSaveStatus === 'saving' ? 'Guardando...' : 'Guardado' }}
          </div>
        </transition>
        <button v-if="!isConsoleExternal" @click="openConsoleWindow" class="px-4 py-2 flex items-center gap-2 bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline" title="Separar Consola">
          <Layout :size="16" /> Ventana Externa
        </button>
        <button v-else @click="isConsoleExternal = false" class="px-4 py-2 flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline hover:bg-primary/30" title="Traer Consola">
          <Layout :size="16" /> Integrar Consola
        </button>
        <button v-if="videoUrl && !isVideoExternal" @click="openVideoWindow" class="px-4 py-2 flex items-center gap-2 bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline" title="Separar Vídeo">
          <Video :size="16" /> Vídeo Externo
        </button>
        <button v-if="isVideoExternal" @click="isVideoExternal = false" class="px-4 py-2 flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 rounded-xl transition-all uppercase tracking-widest text-[10px] font-bold font-headline hover:bg-primary/30" title="Traer Vídeo">
          <Video :size="16" /> Integrar Vídeo
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

    <!-- Match Hub (shown when no video loaded) -->
    <div v-if="!videoUrl" class="flex-1 overflow-y-auto">
      <!-- Hidden file inputs -->
      <input id="resumeFileInput" type="file" @change="handleVideoUpload" accept="video/*" hidden>

      <div class="max-w-5xl mx-auto px-6 py-8">
        <!-- Header row -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="text-2xl font-black font-headline tracking-tight uppercase text-on-surface">Mis Partidos</h2>
            <p class="text-on-surface-variant text-sm mt-1">{{ analystStore.matches.length }} partido{{ analystStore.matches.length !== 1 ? 's' : '' }} analizados</p>
          </div>
          <!-- New match button -->
          <label class="cursor-pointer flex items-center gap-2 bg-primary text-on-primary-container font-headline font-bold text-sm tracking-widest uppercase px-5 py-3 rounded-xl shadow-[0_0_20px_rgba(105,246,184,0.25)] hover:scale-105 transition-all">
            <Video :size="16" /> Nuevo Análisis 
            <input type="file" @change="handleVideoUpload" accept="video/*" hidden>
          </label>
        </div>

        <!-- Matches grid -->
        <div v-if="analystStore.matches.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="match in [...analystStore.matches].sort((a,b) => b.updatedAt - a.updatedAt)"
            :key="match.id"
            class="group bg-surface-container rounded-2xl border border-white/5 hover:border-primary/30 transition-all hover:shadow-[0_0_20px_rgba(105,246,184,0.08)] overflow-hidden flex flex-col"
          >
            <!-- Card header / thumbnail area -->
            <div class="bg-gradient-to-br from-primary/10 to-surface-container-high h-28 flex items-center justify-center relative">
              <div class="w-14 h-14 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Video :size="28" class="text-primary" />
              </div>
              <div class="absolute top-3 right-3 flex gap-2">
                <span class="text-[9px] font-headline font-black uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {{ analystStore.clips.filter(c => c.matchId === match.id).length }} clips
                </span>
              </div>
            </div>

            <!-- Card body -->
            <div class="p-4 flex flex-col gap-3 flex-1">
              <div>
                <h3 class="font-headline font-bold text-sm text-on-surface line-clamp-2 leading-tight">{{ match.title }}</h3>
                <p class="text-[11px] text-on-surface-variant mt-1 truncate">{{ match.videoFileName }}</p>
              </div>
              <div class="flex items-center gap-3 text-[10px] text-on-surface-variant mt-auto">
                <span>{{ new Date(match.updatedAt).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' }) }}</span>
                <span class="ml-auto">{{ analystStore.drawings.filter(d => analystStore.clips.filter(c=>c.matchId===match.id).some(c=>c.id===d.clipId)).length }} anotaciones</span>
              </div>
              <!-- Actions -->
              <div class="flex gap-2 pt-1">
                <button
                  @click="resumeMatch(match)"
                  class="flex-1 flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary-container font-headline font-bold text-xs uppercase tracking-widest py-2.5 rounded-xl transition-all border border-primary/20"
                >
                  <PlayCircle :size="14" /> Continuar
                </button>
                <button
                  @click="analystStore.removeMatch(match.id)"
                  class="p-2.5 bg-error/10 hover:bg-error text-error hover:text-white rounded-xl transition-all border border-error/10"
                  title="Eliminar partido"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center py-24 gap-6 text-center">
          <div class="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 border-dashed animate-pulse">
            <Video :size="36" />
          </div>
          <div>
            <h3 class="font-headline font-bold text-lg text-on-surface uppercase tracking-wide">Sin partidos todavía</h3>
            <p class="text-on-surface-variant text-sm mt-2">Usa el botón <strong>Nuevo Partido</strong> para empezar tu primer análisis.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div v-else class="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
      <!-- Left Area: Player & Tags -->
      <main class="flex-[3] lg:flex-1 flex flex-col min-w-0 min-h-0 bg-surface-container-lowest border-r border-outline-variant/10 relative">
        <div ref="fullscreenWrapperRef" class="flex-1 relative flex flex-row overflow-hidden bg-black group">
          
          <!-- Drawing Tools Sidebar (LEFT) -->
          <transition name="slide-left">
            <div v-if="isDrawing" class="w-24 bg-surface-container-lowest border-r border-white/5 flex flex-col items-center py-3 gap-2 z-[150] shrink-0 shadow-2xl overflow-y-auto scrollbar-none">
              <!-- Grid of Tools -->
              <div class="grid grid-cols-2 gap-1.5 px-3 w-full justify-items-center align-items-center">
                <!-- Row 1 -->
                <button @click="drawingTool = 'select'" :class="drawingTool === 'select' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="(V) Selección">
                  <Move class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'pencil'" :class="drawingTool === 'pencil' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Lápiz (B)">
                  <Pencil class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Row 2 -->
                <button @click="drawingTool = 'line'" :class="drawingTool === 'line' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Línea (L)">
                  <Minus class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'arrow'" :class="drawingTool === 'arrow' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Flecha (A)">
                  <MoveUpRight class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Row 3 -->
                <button @click="drawingTool = 'curved-arrow'" :class="drawingTool === 'curved-arrow' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Curva">
                  <Route class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'dashed-arrow'" :class="drawingTool === 'dashed-arrow' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Desmarque (D)">
                  <Navigation class="w-4.5 h-4.5 rotate-45" stroke-width="2.5" />
                </button>

                <!-- Row 4 -->
                <button @click="drawingTool = 'dashed-line'" :class="drawingTool === 'dashed-line' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Distancia">
                  <Ruler class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'poly'" :class="drawingTool === 'poly' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Zona (K)">
                  <Box class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Row 5 -->
                <button @click="drawingTool = 'text'" :class="drawingTool === 'text' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Texto (X)">
                  <Type class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'circle'" :class="drawingTool === 'circle' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Círculo (C)">
                  <Circle class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Row 6 -->
                <button @click="drawingTool = 'marker'" :class="drawingTool === 'marker' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Marcador (M)">
                  <Target class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'rect'" :class="drawingTool === 'rect' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Rectángulo (R)">
                  <Square class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Row 7 -->
                <button @click="drawingTool = 'triangle'" :class="drawingTool === 'triangle' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Triángulo (T)">
                  <Triangle class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingTool = 'spotlight'" :class="drawingTool === 'spotlight' ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Foco (S)">
                  <Sun class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <!-- Utils Row -->
                <button @click="drawingTool = 'eraser'" :class="drawingTool === 'eraser' ? 'bg-error text-white shadow-lg' : 'text-error/60 hover:bg-error/10' " class="w-9 h-9 rounded-lg transition-all flex items-center justify-center shrink-0" title="Borrar (E)">
                  <Eraser class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
                <button @click="drawingLayerRef?.clearFrame()" class="w-9 h-9 rounded-lg text-on-surface-variant hover:bg-error/20 hover:text-error transition-all flex items-center justify-center shrink-0" title="Limpiar Todo">
                  <Trash2 class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>
              </div>

              <div class="h-px bg-white/5 w-12 mx-auto my-0.5"></div>
              
              <!-- Settings Row -->
              <div class="grid grid-cols-2 gap-2 px-3 w-full justify-items-center align-items-center">
                <button @click="isDrawingFilled = !isDrawingFilled" :class="isDrawingFilled ? 'bg-primary/20 text-primary shadow-lg ring-1 ring-primary/30' : 'text-on-surface-variant hover:bg-white/10'" class="w-9 h-9 rounded-lg transition-all flex items-center justify-center" title="(F) Relleno">
                  <PaintBucket class="w-4.5 h-4.5" stroke-width="2.5" />
                </button>

                <div class="grid grid-cols-2 gap-1 h-9 items-center justify-items-center">
                   <div @click="drawingColor = '#10b981'" class="w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-110 transition-all shadow-md" :class="{'ring-2 ring-white scale-110': drawingColor === '#10b981'}" style="background: #10b981"></div>
                   <div @click="drawingColor = '#ef4444'" class="w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-110 transition-all shadow-md" :class="{'ring-2 ring-white scale-110': drawingColor === '#ef4444'}" style="background: #ef4444"></div>
                   <div @click="drawingColor = '#3b82f6'" class="w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-110 transition-all shadow-md" :class="{'ring-2 ring-white scale-110': drawingColor === '#3b82f6'}" style="background: #3b82f6"></div>
                   <div @click="drawingColor = '#ffeb3b'" class="w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-110 transition-all shadow-md" :class="{'ring-2 ring-white scale-110': drawingColor === '#ffeb3b'}" style="background: #ffeb3b"></div>
                </div>
              </div>
            </div>
          </transition>

          <div class="flex-1 relative flex flex-col min-w-0">
            <!-- Video Placeholder for External Mode -->
            <div v-if="isVideoExternal" class="flex-1 flex flex-col items-center justify-center bg-surface-container/50 gap-4">
              <Video :size="48" class="text-primary/50 animate-pulse" />
              <span class="text-on-surface-variant font-headline tracking-widest uppercase text-sm font-bold">Vídeo reproduciéndose en ventana emergente</span>
              <button @click="isVideoExternal = false" class="mt-4 px-6 py-2 bg-primary text-on-primary-container rounded-xl font-headline font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-105 transition-all">Traer a pestaña principal</button>
            </div>

            <!-- Video + Drawing area -->
            <div v-show="!isVideoExternal" ref="videoOuterContainerRef" class="flex-1 relative flex items-center justify-center border-b border-white/10 bg-black overflow-hidden">
              <!-- This wrapper is sized by JS to match the video's aspect ratio exactly -->
              <div ref="videoWrapperRef" :style="videoWrapperStyle" class="relative flex-shrink-0">
                <video 
                  ref="videoElement" 
                  :src="videoUrl" 
                  @play="onVideoPlay"
                  @pause="onVideoPause"
                  @timeupdate="!isPlaying ? currentTime = (($event.target as HTMLVideoElement).currentTime) : null"
                  @seeked="!isPlaying ? currentTime = (($event.target as HTMLVideoElement).currentTime) : null"
                  @loadedmetadata="duration = (($event.target as HTMLVideoElement).duration); updateVideoWrapper()"
                  class="w-full h-full block"
                ></video>
                <!-- DrawingLayer is a sibling of video inside the same-size wrapper -->
                <DrawingLayer ref="drawingLayerRef" :active="isDrawing" :current-time="currentTime" :active-clip-id="currentRenderClipId" class="absolute inset-0" :style="isDrawing ? 'pointer-events: auto;' : 'pointer-events: none;'" @frame-cleared="titleDismissed = true" />
                <!-- Translucent Subtle Title Overlay: Anchored bottom-left to avoid obstructing action -->
                <transition name="fade">
                  <div v-if="selectedClip && showTitleOverlay" class="absolute bottom-6 left-6 z-[100] pointer-events-none max-w-[60%] flex flex-col items-start translate-y-0">
                    <div class="bg-black/30 backdrop-blur-md border-l-2 border-primary px-4 py-2 rounded-lg shadow-xl border border-white/5">
                      <p class="text-white font-headline font-bold text-sm md:text-base uppercase tracking-[0.15em] shadow-black drop-shadow-md leading-tight">{{ selectedClip.name }}</p>
                      <p v-if="selectedClip.description" class="text-white/60 text-[10px] md:text-xs mt-1 font-medium tracking-wide truncate max-w-[300px]">{{ selectedClip.description }}</p>
                    </div>
                  </div>
                </transition>
              </div>

              <!-- Tactical Auto-pause indicator -->
              <transition name="fade">
                 <div v-if="isAutoPaused" class="absolute top-8 left-1/2 -translate-x-1/2 z-[100]">
                    <div class="bg-red-500/90 text-white font-headline uppercase font-black tracking-[0.2em] text-sm px-6 py-2 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-white/20 animate-pulse backdrop-blur-md">
                       Pausa Táctica (3s)
                    </div>
                 </div>
              </transition>
            </div>
            <!-- Ultra-Slim Transport Controls (BELOW VIDEO) -->
            <div v-show="!isVideoExternal" class="h-10 bg-surface-container-low border-t border-white/10 flex items-center px-4 gap-4 w-full z-[120] shrink-0">
            <div class="flex items-center gap-2">
              <button @click="skipTime(-5)" class="text-on-surface-variant hover:text-primary transition-colors"><RotateCcw :size="12"/></button>
              <button @click="togglePlay" class="w-7 h-7 bg-primary text-on-primary-container rounded-md flex items-center justify-center hover:scale-105 transition-all shadow-md">
                <Pause v-if="isPlaying" :size="14" style="fill: currentColor" />
                <Play v-else :size="14" style="fill: currentColor" />
              </button>
              <button @click="skipTime(5)" class="text-on-surface-variant hover:text-primary transition-colors"><RotateCcw :size="12" style="transform: scaleX(-1)"/></button>
            </div>
            
            <div class="flex-1 flex flex-col items-center px-2">
              <div class="flex justify-between w-full font-headline text-[8px] text-on-surface-variant uppercase tracking-widest leading-none mb-0.5">
                <span>{{ formatTime(currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
              </div>
              <input type="range" class="w-full h-1 rounded-full appearance-none bg-surface-container-highest cursor-pointer accent-primary" :max="duration" step="0.01" :value="currentTime" @input="videoElement!.currentTime = Number(($event.target as HTMLInputElement).value)">
            </div>
            
            <div class="flex items-center gap-3 pl-4 border-l border-white/5">
              <div class="flex items-center gap-2 group/vol relative">
                <button @click="toggleMute" class="text-on-surface-variant hover:text-primary transition-colors"><VolumeX v-if="isMuted || volume === 0" :size="14"/><Volume2 v-else :size="14"/></button>
                <input type="range" class="w-16 h-0.5 appearance-none bg-surface-container-highest rounded-full accent-primary" min="0" max="1" step="0.1" :value="volume" @input="updateVolume(Number(($event.target as HTMLInputElement).value))">
              </div>
              
              <select v-model="playbackRate" class="bg-transparent text-[9px] font-bold text-on-surface hover:text-primary outline-none cursor-pointer appearance-none px-1" title="Velocidad">
                <option :value="0.5">x0.5</option>
                <option :value="1">x1.0</option>
                <option :value="2">x2.0</option>
                <option :value="5">x5.0</option>
              </select>
 
              <button @click="isDrawing = !isDrawing" :disabled="!selectedClip" :class="[isDrawing ? 'text-primary' : 'text-on-surface-variant', !selectedClip ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5']" class="p-1 rounded transition-all" :title="selectedClip ? 'Dibujar' : 'Selecciona un Recorte'"><Pencil :size="14"/></button>
              <button @click="toggleFullscreen" class="p-1 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Pantalla Completa"><Maximize :size="14"/></button>
            </div>
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
      <aside class="w-full lg:w-[400px] flex-1 lg:flex-none flex flex-col bg-surface-container-low border-l border-white/5 shrink-0 z-10 shadow-2xl min-h-0">
        <!-- Clips list -->
        <div class="flex-1 flex flex-col min-h-0 border-b border-white/5">
          <div class="p-3 border-b border-white/5 flex flex-col gap-2 sticky top-0 bg-surface-container-low z-20">
            <div class="flex justify-between items-center">
              <h3 class="font-headline font-bold text-[10px] uppercase tracking-widest text-on-surface flex items-center gap-2"><Scissors :size="14" class="text-primary"/> Recortes</h3>
              <span class="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-headline font-black">{{ filteredClips.length }} / {{ analystStore.currentMatchClips.length }}</span>
            </div>
            
            <!-- Tag Filter -->
            <div class="flex items-center gap-2 bg-surface-container-lowest border border-white/5 rounded-lg px-2 py-1">
              <Settings2 :size="12" class="text-on-surface-variant"/>
              <select v-model="clipFilterTag" class="flex-1 bg-transparent text-[10px] uppercase font-headline font-bold text-on-surface-variant outline-none cursor-pointer">
                <option value="all">TODOS LOS TIPOS</option>
                <option v-for="tagLabel in uniqueClipTags" :key="tagLabel" :value="tagLabel">{{ tagLabel }}</option>
              </select>
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-for="clip in filteredClips" :key="clip.id" 
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
                <button @click.stop="deleteClip(clip.id)" class="p-1.5 bg-error/10 text-error hover:bg-error hover:text-white rounded transition-colors" title="Eliminar Clip y sus dibujos"><Trash2 :size="14"/></button>
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
        <div v-if="selectedClip" class="shrink-0 flex flex-col bg-surface-container border-t-2 border-primary/20 p-3">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-headline text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Pencil :size="12"/> Editor Detalles</h3>
            <button @click="selectedClip = null" class="text-on-surface-variant hover:text-error transition-colors"><X :size="14"/></button>
          </div>
          <div class="space-y-2">
            <input v-model="selectedClip.name" type="text" class="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Nombre de la jugada">
            <textarea v-model="selectedClip.description" rows="1" class="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" placeholder="Análisis de movimientos..."></textarea>
            
            <div class="bg-surface-container-highest/20 p-2 rounded-lg border border-white/5">
              <label class="block text-[10px] text-on-surface-variant font-headline uppercase tracking-widest font-bold mb-4 flex justify-between">
                <span>Ajuste Preciso (Trim)</span>
                <span class="lowercase text-primary">{{ (clipEditorWindowEnd - clipEditorWindowStart).toFixed(0) }}s ventana</span>
              </label>
              
              <div ref="editorTimelineRef" class="editor-timeline-container relative h-12 bg-black rounded-lg border border-white/10 group mb-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
                <!-- Decorative Timeline Ticks -->
                <div class="absolute inset-x-0 bottom-0 h-4 border-t border-white/10 flex justify-between px-2 opacity-30">
                   <div v-for="i in 10" :key="i" class="w-px h-full bg-white"></div>
                </div>

                <!-- Highlight Clip Area -->
                <div class="absolute inset-y-0 bg-primary/20 pointer-events-none transition-all duration-75 border-x-2 border-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                     :style="{ left: `${editorStartPercent}%`, width: `${editorWidthPercent}%` }">
                   <!-- subtle texture -->
                   <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2rVq1cwvT14whDEEAgABBgAlDwq24I+xHwAAAABJRU5ErkJggg==')] opacity-10"></div>
                </div>
                
                <!-- Tactical Pause Markers (Diamonds) -->
                <div v-for="(pause, index) in tacticalPauses" :key="'pause-'+index" 
                     class="absolute top-1.5 w-2 h-2 rotate-45 bg-red-500 z-40 border border-black shadow-[0_0_8px_rgba(239,68,68,1)] pointer-events-none"
                     :style="{ left: `calc(${pause.percent}% - 4px)` }"
                     title="Pausa Táctica (3s)">
                </div>

                <!-- Red Playhead (Current Time) exclusively draggable -->
                <div v-if="currentTime >= clipEditorWindowStart && currentTime <= clipEditorWindowEnd" 
                     class="absolute inset-y-0 w-[24px] -ml-[12px] z-50 cursor-ew-resize flex justify-center group/playhead"
                     :class="{ 'transition-all duration-75': !isEditorScrubbing }"
                     :style="{ left: `${editorCurrentPercent}%` }"
                     @mousedown.stop="handleEditorTimelineMouseDown">
                  <!-- Physical transparent hit-box wrapper for easier mouse grabs is above. -->
                  
                  <!-- Central Line -->
                  <div class="w-[2px] bg-error h-full pointer-events-none shadow-[0_0_5px_red]"></div>
                  
                  <!-- Dot Graphic -->
                  <div class="absolute -top-[5px] w-[10px] h-[10px] bg-error rounded-full outline outline-2 outline-black shadow-[0_0_10px_rgba(239,68,68,0.8)] pointer-events-none group-hover/playhead:scale-125 transition-transform"></div>
                </div>

                <!-- Transparent Native Sliders for Logic -->
                <input type="range" class="timeline-slider timeline-slider-in absolute inset-x-0 -top-1 w-full h-[calc(100%+8px)] z-20 appearance-none bg-transparent m-0 focus:outline-none" 
                       :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.05" :value="selectedClip.startTime" 
                       @input="e => updateClipStart(Number((e.target as HTMLInputElement).value))">
                
                <input type="range" class="timeline-slider timeline-slider-out absolute inset-x-0 -top-1 w-full h-[calc(100%+8px)] z-10 appearance-none bg-transparent m-0 focus:outline-none" 
                       :min="clipEditorWindowStart" :max="clipEditorWindowEnd" step="0.05" :value="selectedClip.endTime" 
                       @input="e => updateClipEnd(Number((e.target as HTMLInputElement).value))">
              </div>

              <div class="flex justify-between items-end mt-2 gap-2">
                <!-- IN POINT -->
                <div class="flex flex-col gap-1">
                  <label class="text-[8px] font-headline text-on-surface-variant uppercase tracking-widest font-bold">Punto IN</label>
                  <div class="flex items-center bg-surface-container-lowest border border-primary/20 rounded-md p-0.5">
                    <input type="text" class="w-16 bg-transparent px-1 py-1 text-[11px] text-primary font-mono outline-none text-center"
                           :value="formatTimeDigits(selectedClip.startTime)" 
                           @blur="e => updateTimeFromDigits(selectedClip!, 'startTime', (e.target as HTMLInputElement).value)">
                    <button @click="setInPoint" class="p-1 text-primary hover:bg-primary/10 rounded" title="Fijar actual"><RotateCcw :size="12" class="rotate-[-45deg]"/></button>
                  </div>
                </div>
                
                <!-- PREVIEW MIDDLE -->
                <button @click="isPreviewing ? stopPreview() : previewClip()" class="w-8 h-8 rounded-full transition-all flex items-center justify-center shrink-0 mb-0.5" :class="isPreviewing ? 'bg-primary text-on-primary-container shadow-lg' : 'bg-surface-container-high hover:bg-white/10 text-on-surface border border-white/10'">
                  <Loader2 v-if="isPreviewing" :size="14" class="animate-spin"/>
                  <Play v-else :size="14" style="fill: currentColor" />
                </button>

                <!-- OUT POINT -->
                <div class="flex flex-col gap-1 items-end">
                  <label class="text-[8px] font-headline text-on-surface-variant uppercase tracking-widest font-bold">Punto OUT</label>
                  <div class="flex items-center bg-surface-container-lowest border border-error/20 rounded-md p-0.5">
                    <button @click="setOutPoint" class="p-1 text-error hover:bg-error/10 rounded" title="Fijar actual"><RotateCcw :size="12" class="rotate-[135deg]"/></button>
                    <input type="text" class="w-16 bg-transparent px-1 py-1 text-[11px] text-error font-mono outline-none text-center"
                           :value="formatTimeDigits(selectedClip.endTime)" 
                           @blur="e => updateTimeFromDigits(selectedClip!, 'endTime', (e.target as HTMLInputElement).value)">
                  </div>
                </div>
              </div>
            </div>
            
            <button @click="handleSave" class="w-full py-2 rounded-lg font-headline text-[9px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2" :class="saveStatus === 'saved' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'bg-surface-container-high border border-white/10 text-on-surface hover:border-primary/30'">
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

<style scoped>
.timeline-slider {
  pointer-events: none;
}
.timeline-slider-in::-webkit-slider-thumb {
  pointer-events: auto;
  appearance: none;
  width: 14px;
  height: 48px;
  background: #10b981; /* primary color */
  border-radius: 4px 0 0 4px;
  cursor: ew-resize;
  border: 2px solid #000;
  border-right: none;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  position: relative;
  z-index: 50;
}
.timeline-slider-out::-webkit-slider-thumb {
  pointer-events: auto;
  appearance: none;
  width: 14px;
  height: 48px;
  background: #ef4444; /* error color */
  border-radius: 0 4px 4px 0;
  cursor: ew-resize;
  border: 2px solid #000;
  border-left: none;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  position: relative;
  z-index: 50;
}
.timeline-slider-in::-moz-range-thumb {
  pointer-events: auto;
  width: 14px;
  height: 48px;
  background: #10b981;
  border-radius: 4px 0 0 4px;
  cursor: ew-resize;
  border: 2px solid #000;
  border-right: none;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}
.timeline-slider-out::-moz-range-thumb {
  pointer-events: auto;
  width: 14px;
  height: 48px;
  background: #ef4444;
  border-radius: 0 4px 4px 0;
  cursor: ew-resize;
  border: 2px solid #000;
  border-left: none;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}
</style>
