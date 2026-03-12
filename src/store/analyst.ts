import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tag {
  id: string
  label: string
  color: string
  category: string
  durationBefore: number // seconds before click
  durationAfter: number  // seconds after click
}

export interface Clip {
  id: string
  name: string
  startTime: number
  endTime: number
  tagId: string
  videoUrl: string
  notes?: string
  description?: string
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

  const clips = ref<Clip[]>([])

  const addTag = (label: string, color: string, category: string, durationBefore: number, durationAfter: number) => {
    tags.value.push({
      id: Date.now().toString(),
      label,
      color,
      category,
      durationBefore,
      durationAfter
    })
  }

  const removeTag = (id: string) => {
    tags.value = tags.value.filter(t => t.id !== id)
  }

  const addClip = (clip: Omit<Clip, 'id'>) => {
    clips.value.push({
      ...clip,
      id: Date.now().toString()
    })
  }

  const removeClip = (id: string) => {
    clips.value = clips.value.filter(c => c.id !== id)
  }

  return { tags, clips, addTag, removeTag, addClip, removeClip }
})
