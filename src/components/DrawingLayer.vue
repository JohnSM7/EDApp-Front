<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { 
  Pencil, MoveUpRight, Circle, Square, 
  Minus, Trash2, MousePointer2
} from 'lucide-vue-next'
import { useAnalystStore, type Drawing } from '../store/analyst'

const props = defineProps<{
  active: boolean
  currentTime: number
}>()

const analystStore = useAnalystStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const tempCanvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const tempCtx = ref<CanvasRenderingContext2D | null>(null)

const isDrawing = ref(false)
const currentTool = ref<'pencil' | 'line' | 'arrow' | 'circle' | 'rect'>('pencil')
const color = ref('#ffeb3b')
const currentPoints = ref<{ x: number, y: number }[]>([])

// Draw settings
const LINE_WIDTH = 4
const VISIBILITY_WINDOW = 0.8 // Draw stays visible for 0.8 seconds around its timestamp

onMounted(() => {
  initCanvases()
  window.addEventListener('resize', resizeCanvas)
})

const initCanvases = () => {
  if (canvasRef.value && tempCanvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d')
    tempCtx.value = tempCanvasRef.value.getContext('2d')
    resizeCanvas()
    render()
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
    render()
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
  currentPoints.value = [{ x, y }]
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !props.active) return
  const { x, y } = getMousePos(e)
  
  if (currentTool.value === 'pencil') {
    currentPoints.value.push({ x, y })
    drawTemp()
  } else {
    // For shapes, we only need start and current end point
    if (currentPoints.value.length > 1) {
      currentPoints.value[1] = { x, y }
    } else {
      currentPoints.value.push({ x, y })
    }
    drawTemp()
  }
}

const stopDrawing = () => {
  if (!isDrawing.value) return
  isDrawing.value = false
  
  if (currentPoints.value.length > 1 && canvasRef.value) {
    analystStore.addDrawing({
      time: props.currentTime,
      tool: currentTool.value,
      points: [...currentPoints.value],
      color: color.value,
      baseWidth: canvasRef.value.width,
      baseHeight: canvasRef.value.height
    })
  }
  
  currentPoints.value = []
  tempCtx.value?.clearRect(0, 0, tempCanvasRef.value!.width, tempCanvasRef.value!.height)
  render()
}

const drawTemp = () => {
  if (!tempCtx.value || currentPoints.value.length < 2) return
  const tCtx = tempCtx.value
  tCtx.clearRect(0, 0, tempCanvasRef.value!.width, tempCanvasRef.value!.height)
  
  const p1 = currentPoints.value[0]!
  const p2 = currentPoints.value[currentPoints.value.length - 1]!
  
  renderObject(tCtx, {
    tool: currentTool.value,
    points: currentPoints.value,
    color: color.value,
    id: 'temp',
    time: props.currentTime
  })
}

const render = () => {
  if (!ctx.value || !canvasRef.value) return
  const mainCtx = ctx.value
  mainCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  analystStore.drawings.forEach(drawing => {
    // Only render if within temporal window
    const diff = Math.abs(drawing.time - props.currentTime)
    if (diff < VISIBILITY_WINDOW) {
      mainCtx.globalAlpha = Math.max(0, 1 - (diff / VISIBILITY_WINDOW))
      renderObject(mainCtx, drawing)
    }
  })
  mainCtx.globalAlpha = 1
}

const renderObject = (context: CanvasRenderingContext2D, obj: any) => {
  context.strokeStyle = obj.color
  context.fillStyle = obj.color
  context.lineWidth = LINE_WIDTH
  context.lineCap = 'round'
  context.lineJoin = 'round'
  
  context.beginPath()
  
  if (obj.tool === 'pencil') {
    context.moveTo(obj.points[0].x, obj.points[0].y)
    for (let i = 1; i < obj.points.length; i++) {
        context.lineTo(obj.points[i].x, obj.points[i].y)
    }
    context.stroke()
  } else {
    const p1 = obj.points[0]
    const p2 = obj.points[obj.points.length - 1]
    
    if (obj.tool === 'line') {
      context.moveTo(p1.x, p1.y)
      context.lineTo(p2.x, p2.y)
      context.stroke()
    } else if (obj.tool === 'rect') {
      context.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
    } else if (obj.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      context.arc(p1.x, p1.y, radius, 0, 2 * Math.PI)
      context.stroke()
    } else if (obj.tool === 'arrow') {
      drawArrow(context, p1.x, p1.y, p2.x, p2.y)
    }
  }
}

const drawArrow = (context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const headlen = 20
  const angle = Math.atan2(y2 - y1, x2 - x1)
  
  // Base line
  context.moveTo(x1, y1)
  context.lineTo(x2, y2)
  context.stroke()
  
  // Arrow head
  context.beginPath()
  context.moveTo(x2, y2)
  context.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
  context.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  context.closePath()
  context.fill()
}

const clearFrame = () => {
  analystStore.clearDrawingsAt(props.currentTime)
  render()
}

watch(() => props.currentTime, render)
watch(() => analystStore.drawings, render, { deep: true })
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

    <div v-if="active" class="drawing-controls glass-card gold-border">
      <div class="tools-group">
        <button @click="currentTool = 'pencil'" :class="{ active: currentTool === 'pencil' }" title="Lápiz Libre"><Pencil :size="18" /></button>
        <button @click="currentTool = 'line'" :class="{ active: currentTool === 'line' }" title="Distancia"><Minus :size="18" /></button>
        <button @click="currentTool = 'arrow'" :class="{ active: currentTool === 'arrow' }" title="Vector Movimiento"><MoveUpRight :size="18" /></button>
        <button @click="currentTool = 'circle'" :class="{ active: currentTool === 'circle' }" title="Zona / Jugador"><Circle :size="18" /></button>
        <button @click="currentTool = 'rect'" :class="{ active: currentTool === 'rect' }" title="Bloque"><Square :size="18" /></button>
      </div>
      
      <div class="divider"></div>
      
      <div class="colors-group">
        <div class="color-swatches">
           <div @click="color = '#ffeb3b'" class="swatch" :style="{ background: '#ffeb3b' }" :class="{ active: color === '#ffeb3b' }"></div>
           <div @click="color = '#ef4444'" class="swatch" :style="{ background: '#ef4444' }" :class="{ active: color === '#ef4444' }"></div>
           <div @click="color = '#3b82f6'" class="swatch" :style="{ background: '#3b82f6' }" :class="{ active: color === '#3b82f6' }"></div>
        </div>
        <button @click="clearFrame" class="clear-btn" title="Borrar este frame"><Trash2 :size="18" /></button>
      </div>
    </div>
    
    <!-- Timeline Drawing Indicators -->
    <div v-if="active" class="frame-indicator">
       <MousePointer2 :size="12" />
       Frame Analizado: {{ currentTime.toFixed(2) }}s
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
  padding: 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

.tools-group, .colors-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.color-swatches {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.2s;
}

.swatch:hover { transform: scale(1.2); }
.swatch.active { border-color: white; transform: scale(1.1); }

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

button.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: white;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
}

.clear-btn:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

.frame-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #3b82f6;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.gold-border {
  border: 1px solid rgba(212, 175, 55, 0.3);
}
</style>
