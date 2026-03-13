<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useAnalystStore } from '../store/analyst'
import { Layout } from 'lucide-vue-next'

const analystStore = useAnalystStore()
const consoleChannel = new BroadcastChannel('analyst-console')

const groupedTags = computed(() => {
  const groups: Record<string, any[]> = {}
  analystStore.tags.forEach(tag => {
    if (!groups[tag.category]) groups[tag.category] = []
    groups[tag.category]!.push(tag)
  })
  return groups
})

const sendClipEvent = (tag: any) => {
  consoleChannel.postMessage({
    type: 'CREATE_CLIP',
    tag: JSON.parse(JSON.stringify(tag)) 
  })
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault()
    if (event.key === 'ArrowLeft') {
      consoleChannel.postMessage({ type: 'SKIP_VIDEO', amount: -5 })
    } else if (event.key === 'ArrowRight') {
      consoleChannel.postMessage({ type: 'SKIP_VIDEO', amount: 5 })
    } else if (event.key === ' ') {
      consoleChannel.postMessage({ type: 'TOGGLE_PLAY' })
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="console-window">
    <div class="header">
      <Layout :size="18" />
      <span>Consola Táctica Externa</span>
    </div>
    
    <div class="body">
      <div class="groups-container">
        <div v-for="(tags, category) in groupedTags" :key="category" class="tag-group">
          <div class="group-header">{{ category }}</div>
          <div class="tags-wall">
            <button 
              v-for="tag in tags" :key="tag.id"
              class="action-tile"
              :style="{ '--tile-color': tag.color }"
              @click="sendClipEvent(tag)"
            >
              <span class="tile-label">{{ tag.label }}</span>
              <span class="tile-meta">{{ tag.durationBefore }}s / {{ tag.durationAfter }}s</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="status-dot"></div>
      LISTO PARA ANALIZAR
    </div>
  </div>
</template>

<style scoped>
.console-window {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  color: white;
  font-family: 'Inter', sans-serif;
}

.header {
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.body {
  flex: 1;
  padding: 6px;
  overflow-y: auto;
  background: #0a0f1d;
}

.groups-container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  height: 100%;
}

.tag-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
}

/* Specific ordering to match user's image logic */
.tag-group:nth-child(1) { order: 1; } /* Defensa */
.tag-group:nth-child(2) { order: 3; } /* Ataque */
.tag-group:nth-child(3) { order: 2; } /* Transiciones */
.tag-group:nth-child(4) { order: 5; } /* Resultado */
.tag-group:nth-child(5) { order: 4; } /* BP Def */
.tag-group:nth-child(6) { order: 6; } /* BP Ofen */

.group-header {
  font-size: 9px;
  font-weight: 900;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.tags-wall {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.action-tile {
  background: var(--tile-color);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 6px 4px;
  border-radius: 3px;
  text-align: center;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.action-tile:hover {
  filter: brightness(1.2);
  transform: scale(1.02);
}

.action-tile:active {
  transform: scale(0.95);
}

.tile-label {
  font-weight: 800;
  font-size: 9px;
  text-transform: uppercase;
  color: white;
  line-height: 1;
}

.tile-meta {
  font-size: 9px;
  opacity: 0.9;
  background: rgba(0,0,0,0.25);
  padding: 2px 4px;
  border-radius: 3px;
}

.footer {
  padding: 12px 16px;
  background: rgba(0,0,0,0.3);
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 10px #10b981;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
</style>
