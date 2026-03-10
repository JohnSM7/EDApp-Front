<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { 
  Pencil, MoveUpRight, Circle, Square, 
  Minus, Trash2
} from 'lucide-vue-next'

const props = defineProps<{
  active: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const tempCanvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const tempCtx = ref<CanvasRenderingContext2D | null>(null)

const isDrawing = ref(false)
const currentTool = ref<'pencil' | 'line' | 'arrow' | 'circle' | 'rect'>('pencil')
const color = ref('#ffeb3b') // Football yellow by default
const startX = ref(0)
const startY = ref(0)

onMounted(() => {
  initCanvases()
  window.addEventListener('resize', resizeCanvas)
})

const initCanvases = () => {
  if (canvasRef.value && tempCanvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d')
    tempCtx.value = tempCanvasRef.value.getContext('2d')
    resizeCanvas()
  }
}

const resizeCanvas = () => {
  const container = canvasRef.value?.parentElement
  if (container && canvasRef.value && tempCanvasRef.value) {
    const { clientWidth, clientHeight } = container
    canvasRef.value.width = clientWidth
    canvasRef.value.height = clientHeight
    tempCanvasRef.value.width = clientWidth
    tempCanvasRef.value.height = clientHeight
  }
}

const getMousePos = (e: MouseEvent) => {
  const rect = canvasRef.value!.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

const startDrawing = (e: MouseEvent) => {
  if (!props.active) return
  isDrawing.value = true
  const { x, y } = getMousePos(e)
  startX.value = x
  startY.value = y
  
  if (currentTool.value === 'pencil') {
    ctx.value?.beginPath()
    ctx.value?.moveTo(x, y)
  }
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !props.active) return
  const { x, y } = getMousePos(e)
  
  if (currentTool.value === 'pencil') {
    ctx.value!.strokeStyle = color.value
    ctx.value!.lineWidth = 3
    ctx.value!.lineCap = 'round'
    ctx.value!.lineTo(x, y)
    ctx.value!.stroke()
  } else {
    // Clear temp canvas and draw the guide
    tempCtx.value?.clearRect(0, 0, tempCanvasRef.value!.width, tempCanvasRef.value!.height)
    drawShape(tempCtx.value!, startX.value, startY.value, x, y)
  }
}

const stopDrawing = (e: MouseEvent) => {
  if (!isDrawing.value) return
  isDrawing.value = false
  const { x, y } = getMousePos(e)
  
  if (currentTool.value !== 'pencil') {
    drawShape(ctx.value!, startX.value, startY.value, x, y)
    tempCtx.value?.clearRect(0, 0, tempCanvasRef.value!.width, tempCanvasRef.value!.height)
  }
}

const drawShape = (context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  context.strokeStyle = color.value
  context.fillStyle = color.value
  context.lineWidth = 3
  context.lineCap = 'round'
  
  context.beginPath()
  
  if (currentTool.value === 'line') {
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
  } else if (currentTool.value === 'rect') {
    context.strokeRect(x1, y1, x2 - x1, y2 - y1)
  } else if (currentTool.value === 'circle') {
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    context.arc(x1, y1, radius, 0, 2 * Math.PI)
  } else if (currentTool.value === 'arrow') {
    const headlen = 15
    const angle = Math.atan2(y2 - y1, x2 - x1)
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
    context.moveTo(x2, y2)
    context.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  }
  
  context.stroke()
}

const clear = () => {
  ctx.value?.clearRect(0, 0, canvasRef.value!.width, canvasRef.value!.height)
}

watch(() => props.active, (val) => {
  if (val) setTimeout(resizeCanvas, 0)
})
</script>

<template>
  <div class="drawing-layer" :class="{ active: active }">
    <canvas ref="canvasRef" class="main-canvas"></canvas>
    <canvas 
      ref="tempCanvasRef" 
      class="temp-canvas"
      @mousedown="startDrawing"
      @mousemove="draw"
      @mouseup="stopDrawing"
      @mouseleave="stopDrawing"
    ></canvas>

    <div v-if="active" class="drawing-controls glass-card">
      <div class="tools-group">
        <button @click="currentTool = 'pencil'" :class="{ active: currentTool === 'pencil' }" title="Lápiz"><Pencil :size="18" /></button>
        <button @click="currentTool = 'line'" :class="{ active: currentTool === 'line' }" title="Línea"><Minus :size="18" /></button>
        <button @click="currentTool = 'arrow'" :class="{ active: currentTool === 'arrow' }" title="Flecha"><MoveUpRight :size="18" /></button>
        <button @click="currentTool = 'circle'" :class="{ active: currentTool === 'circle' }" title="Círculo"><Circle :size="18" /></button>
        <button @click="currentTool = 'rect'" :class="{ active: currentTool === 'rect' }" title="Rectángulo"><Square :size="18" /></button>
      </div>
      
      <div class="divider"></div>
      
      <div class="colors-group">
        <input type="color" v-model="color" class="color-picker">
        <button @click="clear" class="clear-btn" title="Limpiar todo"><Trash2 :size="18" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawing-layer {
  position: absolute;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}

.drawing-layer.active {
  pointer-events: auto;
}

canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.temp-canvas {
  cursor: crosshair;
}

.drawing-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
  pointer-events: auto;
}

.tools-group, .colors-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.divider {
  height: 1px;
  background: var(--border-glass);
}

button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
}

button.active {
  background: var(--primary);
  border-color: var(--primary);
}

.color-picker {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
