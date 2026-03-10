import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tag {
  id: string
  label: string
  color: string
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
    { id: '1', label: 'Gol', color: '#10b981', durationBefore: 5, durationAfter: 5 },
    { id: '2', label: 'Falta', color: '#ef4444', durationBefore: 5, durationAfter: 5 },
    { id: '3', label: 'Contra', color: '#3b82f6', durationBefore: 8, durationAfter: 4 },
    { id: '4', label: 'Presión', color: '#f59e0b', durationBefore: 10, durationAfter: 2 },
    { id: '5', label: 'Recuperación', color: '#8b5cf6', durationBefore: 6, durationAfter: 4 },
  ])

  const clips = ref<Clip[]>([])

  const addTag = (label: string, color: string, durationBefore: number, durationAfter: number) => {
    tags.value.push({
      id: Date.now().toString(),
      label,
      color,
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
