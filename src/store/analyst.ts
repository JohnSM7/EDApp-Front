import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Tag {
  id: string
  label: string
  color: string
  category: string
  durationBefore: number // seconds before click
  durationAfter: number  // seconds after click
}

export interface Drawing {
  id: string
  clipId?: string // Vinculado exclusivamente a un recorte
  time: number
  data: string // Initial Konva serialized JSON
  keyframes?: { time: number, data: string }[] // For animation/tracking
  duration?: number // How long it's visible (default e.g. 5s)
}

export interface Clip {
  id: string
  matchId: string  // Links clip to a specific match/video session
  name: string
  startTime: number
  endTime: number
  tagId: string
  videoUrl: string
  notes?: string
  description?: string
}

export interface Match {
  id: string            // hash: `${filename}_${filesize}` — stable identity
  title: string         // editable match name, e.g. "Liga J12 - Real vs Barça"
  videoFileName: string
  videoFileSize: number
  createdAt: number
  updatedAt: number
}

export const useAnalystStore = defineStore('analyst', () => {
  const tags = ref<Tag[]>([
    // BLOQUE ROJO - Defensa
    { id: '1', label: 'Bloque Alto', color: '#ef4444', category: 'Defensa', durationBefore: 5, durationAfter: 5 },
    { id: '2', label: 'Bloque Medio', color: '#ef4444', category: 'Defensa', durationBefore: 5, durationAfter: 5 },
    { id: '3', label: 'Bloque Bajo', color: '#ef4444', category: 'Defensa', durationBefore: 10, durationAfter: 2 },
    { id: '4', label: 'Juego Directo Def.', color: '#ef4444', category: 'Defensa', durationBefore: 8, durationAfter: 4 },
    { id: '5', label: 'Defensa Área', color: '#ef4444', category: 'Defensa', durationBefore: 8, durationAfter: 4 },
    { id: '6', label: 'Trans. Def.', color: '#ef4444', category: 'Defensa', durationBefore: 6, durationAfter: 4 },

    // BLOQUE CYAN - Ataque
    { id: '7', label: 'Inicios', color: '#06b6d4', category: 'Ataque', durationBefore: 12, durationAfter: 3 },
    { id: '8', label: 'Continuidad', color: '#06b6d4', category: 'Ataque', durationBefore: 12, durationAfter: 3 },
    { id: '9', label: 'Ataque', color: '#06b6d4', category: 'Ataque', durationBefore: 15, durationAfter: 5 },
    { id: '10', label: 'Juego Directo Of.', color: '#06b6d4', category: 'Ataque', durationBefore: 8, durationAfter: 4 },
    { id: '11', label: 'Recuperación', color: '#06b6d4', category: 'Ataque', durationBefore: 6, durationAfter: 4 },
    { id: '12', label: 'Trans. Ofen.', color: '#06b6d4', category: 'Ataque', durationBefore: 5, durationAfter: 7 },

    // BLOQUE AZUL / OTROS
    { id: '13', label: 'Pérdida', color: '#3b82f6', category: 'Transiciones', durationBefore: 4, durationAfter: 2 },
    { id: '14', label: 'Centro', color: '#3b82f6', category: 'Transiciones', durationBefore: 6, durationAfter: 4 },
    { id: '15', label: 'Gol Favor', color: '#10b981', category: 'Resultado', durationBefore: 10, durationAfter: 5 },
    { id: '16', label: 'Gol Contra', color: '#f59e0b', category: 'Resultado', durationBefore: 10, durationAfter: 5 },

    // BP - Balón Parado (Naranjas / Azules abajo)
    { id: '17', label: 'Córner Def.', color: '#f97316', category: 'BP Def.', durationBefore: 10, durationAfter: 5 },
    { id: '18', label: 'Falta Def.', color: '#f97316', category: 'BP Def.', durationBefore: 10, durationAfter: 5 },
    { id: '19', label: 'Córner Ofen.', color: '#3b82f6', category: 'BP Ofen.', durationBefore: 5, durationAfter: 10 },
    { id: '20', label: 'Falta Ofen.', color: '#3b82f6', category: 'BP Ofen.', durationBefore: 5, durationAfter: 10 }
  ])

  const matches = ref<Match[]>([])
  const currentMatchId = ref<string | null>(null)
  const drawings = ref<Drawing[]>([])
  const clips = ref<Clip[]>([])

  // ------------------------------------------------------------------
  // Computed: clips/drawings filtered by current match
  // ------------------------------------------------------------------
  const currentMatchClips = computed(() =>
    currentMatchId.value
      ? clips.value.filter(c => c.matchId === currentMatchId.value)
      : clips.value
  )

  const currentMatch = computed(() =>
    matches.value.find(m => m.id === currentMatchId.value) ?? null
  )

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------
  const saveToStorage = () => {
    localStorage.setItem('edapp_analyst_drawings', JSON.stringify(drawings.value))
    localStorage.setItem('edapp_analyst_clips', JSON.stringify(clips.value))
    localStorage.setItem('edapp_analyst_matches', JSON.stringify(matches.value))
  }

  const loadStoredData = () => {
    try {
      const savedDrawings = localStorage.getItem('edapp_analyst_drawings')
      const savedClips = localStorage.getItem('edapp_analyst_clips')
      const savedMatches = localStorage.getItem('edapp_analyst_matches')

      if (savedDrawings) drawings.value = JSON.parse(savedDrawings)
      if (savedClips) clips.value = JSON.parse(savedClips)
      if (savedMatches) matches.value = JSON.parse(savedMatches)

      // Migration: assign legacy clips (no matchId) to a placeholder match
      clips.value.forEach(c => {
        if (!c.matchId) c.matchId = 'legacy'
      })
    } catch(e) {}
  }

  loadStoredData()

  // Sync across windows (e.g. console window)
  window.addEventListener('storage', (e) => {
    if (e.key === 'edapp_analyst_drawings') {
      try { drawings.value = JSON.parse(e.newValue || '[]') } catch(ex) {}
    }
    if (e.key === 'edapp_analyst_clips') {
      try { clips.value = JSON.parse(e.newValue || '[]') } catch(ex) {}
    }
    if (e.key === 'edapp_analyst_matches') {
      try { matches.value = JSON.parse(e.newValue || '[]') } catch(ex) {}
    }
  })

  // ------------------------------------------------------------------
  // Match actions
  // ------------------------------------------------------------------
  /** Stable ID from file metadata — no file reading needed */
  const getMatchId = (fileName: string, fileSize: number): string =>
    `${fileName}_${fileSize}`

  /**
   * Call when a video file is loaded.
   * Returns the existing or newly created match.
   */
  const loadOrCreateMatch = (fileName: string, fileSize: number): Match => {
    const id = getMatchId(fileName, fileSize)
    let match = matches.value.find(m => m.id === id)

    if (!match) {
      // Remove date/time suffix from filename for a cleaner default title
      const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
      match = {
        id,
        title: baseName,
        videoFileName: fileName,
        videoFileSize: fileSize,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      matches.value.push(match)
      saveToStorage()
    }

    currentMatchId.value = id
    return match
  }

  const updateMatchTitle = (id: string, title: string) => {
    const m = matches.value.find(m => m.id === id)
    if (m) {
      m.title = title
      m.updatedAt = Date.now()
      saveToStorage()
    }
  }

  const removeMatch = (id: string) => {
    matches.value = matches.value.filter(m => m.id !== id)
    clips.value = clips.value.filter(c => c.matchId !== id)
    drawings.value = drawings.value.filter(d => {
      const clip = clips.value.find(c => c.id === d.clipId)
      return clip ? clip.matchId !== id : true
    })
    if (currentMatchId.value === id) currentMatchId.value = null
    saveToStorage()
  }

  // ------------------------------------------------------------------
  // Tag actions
  // ------------------------------------------------------------------
  const addTag = (tag: Omit<Tag, 'id'>) => {
    tags.value.push({ ...tag, id: Date.now().toString() })
  }

  const removeTag = (id: string) => {
    tags.value = tags.value.filter(t => t.id !== id)
  }

  // ------------------------------------------------------------------
  // Clip actions
  // ------------------------------------------------------------------
  const addClip = (clip: Omit<Clip, 'id'>) => {
    const newClip: Clip = {
      ...clip,
      matchId: clip.matchId || currentMatchId.value || 'legacy',
      id: Date.now().toString()
    }
    clips.value.push(newClip)
    saveToStorage()
  }

  const removeClip = (id: string) => {
    clips.value = clips.value.filter(c => c.id !== id)
    drawings.value = drawings.value.filter(d => d.clipId !== id)
    saveToStorage()
  }

  // ------------------------------------------------------------------
  // Drawing actions
  // ------------------------------------------------------------------
  const addDrawing = (drawing: Omit<Drawing, 'id'>) => {
    drawings.value.push({
      ...drawing,
      id: Math.random().toString(36).substr(2, 9)
    })
    saveToStorage()
  }

  const removeDrawing = (id: string) => {
    drawings.value = drawings.value.filter(d => d.id !== id)
    saveToStorage()
  }

  const clearDrawingsAt = (time: number) => {
    const threshold = 0.8
    drawings.value = drawings.value.filter(d => Math.abs(d.time - time) > threshold)
    saveToStorage()
  }

  const isDrawingFilled = ref(false)
  const drawingColor = ref('#ffeb3b')
  const drawingTool = ref<'select' | 'pencil' | 'line' | 'dashed-line' | 'arrow' | 'dashed-arrow' | 'curved-arrow' | 'circle' | 'rect' | 'triangle' | 'poly' | 'text' | 'marker' | 'spotlight' | 'eraser'>('pencil')

  return {
    tags,
    clips,
    currentMatchClips,
    drawings,
    matches,
    currentMatchId,
    currentMatch,
    drawingTool,
    drawingColor,
    isDrawingFilled,
    addTag,
    removeTag,
    addClip,
    removeClip,
    addDrawing,
    removeDrawing,
    clearDrawingsAt,
    loadOrCreateMatch,
    updateMatchTitle,
    removeMatch,
    getMatchId,
    saveToStorage
  }
})
