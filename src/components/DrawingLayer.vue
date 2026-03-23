<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, shallowRef } from 'vue'
import Konva from 'konva'
import { useAnalystStore } from '../store/analyst'

const props = defineProps<{
  active: boolean
  currentTime: number
  activeClipId?: string
}>()

const emit = defineEmits<{
  (e: 'frame-cleared'): void
}>()

const analystStore = useAnalystStore()
const containerRef = ref<HTMLDivElement | null>(null)

// Konva variables (shallowRefs for performance)
const stage = shallowRef<Konva.Stage | null>(null)
const mainLayer = shallowRef<Konva.Layer | null>(null)
const transformer = shallowRef<Konva.Transformer | null>(null)

// Undo History Stack
const historyStack = ref<string[]>([])
const pushHistory = () => {
  if (historyStack.value.length > 50) historyStack.value.shift()
  historyStack.value.push(JSON.stringify(analystStore.drawings))
}
const undo = () => {
  if (historyStack.value.length > 0) {
    const prevStateStr = historyStack.value.pop()
    if (prevStateStr) {
      analystStore.drawings = JSON.parse(prevStateStr)
      localStorage.setItem('edapp_analyst_drawings', JSON.stringify(analystStore.drawings))
      transformer.value?.nodes([])
      renderDrawings()
    }
  }
}

import { storeToRefs } from 'pinia'

const isDrawing = ref(false)
const { drawingTool: currentTool, drawingColor: color, isDrawingFilled: isFilled } = storeToRefs(analystStore)
const defaultDuration = ref(5) // Tiempo visible por defecto (en segundos)

// Inline Text Entry
const isTypingText = ref(false)
const textInputPos = ref({ x: 0, y: 0 })
const textInputValue = ref('')
const textInputRef = ref<HTMLTextAreaElement | null>(null)

let currentShape: Konva.Shape | Konva.Line | Konva.Group | null = null
let preventRenderDrawings = false // used to prevent recreate while dragging

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  initKonva()
  
  // Observe the container itself — it changes when the aspect-ratio box resizes
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => handleResize())
    })
    resizeObserver.observe(containerRef.value)
  }

  document.addEventListener('fullscreenchange', () => {
    setTimeout(handleResize, 150)
  })

  window.addEventListener('keydown', handleKeyDown)
  requestAnimationFrame(handleResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleResize)
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('keydown', handleKeyDown)
  if (stage.value) stage.value.destroy()
})

watch(() => props.active, (val) => {
  if (val) {
    setTimeout(handleResize, 50)
  }
})

const handleKeyDown = (e: KeyboardEvent) => {
  // Ignorar inputs y modales
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  // Ctrl + Z (Deshacer)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    undo()
    return
  }

  if (!props.active) return

  // Borrar selección (Delete/Backspace)
  const tx = transformer.value
  if ((e.key === 'Backspace' || e.key === 'Delete') && tx) {
    const nodes = tx.nodes()
    if (nodes.length > 0) {
      pushHistory() // Save state before Delete
      const selectedIds = nodes.map((n: any) => n.id())
      selectedIds.forEach((sid: string) => analystStore.removeDrawing(sid))
      nodes.forEach((n: any) => n.destroy())
      tx.nodes([])
      renderDrawings()
    }
    return
  }

  // Atajos de Herramientas (1 Letra)
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    const key = e.key.toLowerCase()
    const validKeys: Record<string, typeof currentTool.value> = {
      'v': 'select',
      'b': 'pencil',
      'l': 'line',
      'a': 'arrow',
      'c': 'circle',
      'r': 'rect',
      't': 'triangle',
      'k': 'poly',
      'x': 'text',
      'm': 'marker',
      'd': 'dashed-arrow',
      's': 'spotlight',
      'e': 'eraser'
    }
    if (validKeys[key]) currentTool.value = validKeys[key]
    else if (key === 'f') isFilled.value = !isFilled.value
  }
}

const clearCanvas = () => {
  const ml = mainLayer.value
  if (ml) {
    ml.getChildren((n: any) => n.className !== 'Transformer').forEach((n: any) => n.destroy())
    ml.batchDraw()
    transformer.value?.nodes([])
    emit('frame-cleared')
  }
}

const initKonva = () => {
  if (!containerRef.value) return
  const { clientWidth, clientHeight } = containerRef.value.parentElement || document.body
  
  const st = new Konva.Stage({
    container: containerRef.value,
    width: clientWidth,
    height: clientHeight,
  })
  stage.value = st

  const ml = new Konva.Layer()
  mainLayer.value = ml
  st.add(ml)
  
  const tx = new Konva.Transformer({
    nodes: [],
    padding: 5,
    borderStroke: '#10b981',
    anchorStroke: '#10b981',
    anchorFill: '#ffffff',
    anchorSize: 8,
  })
  transformer.value = tx
  ml.add(tx)

  st.on('mousedown touchstart', handleMouseDown)
  st.on('mousemove touchmove', handleMouseMove)
  st.on('mouseup touchend', handleMouseUp)

  st.on('click tap', (e: any) => {
    // Select Tool handling
    if (currentTool.value !== 'select') return
    
    let node = e.target
    if (node === st || !node) {
      tx.nodes([])
      return
    }
    
    // Bubble up to the root drawing node (child of mainLayer)
    while (node.getParent() && node.getParent() !== ml) {
      node = node.getParent()
    }
    
    if (node.className === 'Transformer') {
      return
    }
    
    tx.nodes([node])
    ml.batchDraw()
  })

  st.on('dragstart transformstart', () => {
    pushHistory() // Save state before moving/scaling
    preventRenderDrawings = true
  })

  st.on('dragend transformend', (e: any) => {
    updateShapeInStore(e.target)
    preventRenderDrawings = false
  })

  renderDrawings()
}

const handleResize = () => {
  if (!stage.value || !containerRef.value) return

  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight

  if (w <= 0 || h <= 0) return

  stage.value.width(w)
  stage.value.height(h)

  // DrawingLayer lives inside: wrapper > .drawing-layer > containerRef
  // The wrapper also contains the <video> as a sibling of .drawing-layer
  const drawingLayerDiv = containerRef.value.parentElement
  const wrapper = drawingLayerDiv?.parentElement
  const video = wrapper?.querySelector('video') as HTMLVideoElement | null

  if (video && video.videoWidth > 0) {
    // All coordinates are stored in native video-pixel space
    // Scale the stage so that (0,0)-(videoWidth,videoHeight) maps to the container
    const scale = w / video.videoWidth
    stage.value.scale({ x: scale, y: scale })
  } else {
    stage.value.scale({ x: 1, y: 1 })
  }

  stage.value.batchDraw()
  renderDrawings()
}

  let startPos = { x: 0, y: 0 }
  
const getPointerPos = () => {
  if (!stage.value) return null
  const transform = stage.value.getAbsoluteTransform().copy().invert()
  const pos = stage.value.getPointerPosition()
  if (!pos) return null
  return transform.point(pos)
}
const handleMouseDown = (e: any) => {
  const st = stage.value
  const ml = mainLayer.value
  const tx = transformer.value
  if (!props.active || !st || !ml) return

  // Eraser immediate handling
  if (currentTool.value === 'eraser') {
    let node = e?.target
    if ((node as any) === st) return
    while (node.getParent() && node.getParent() !== ml) {
      node = node.getParent()
    }
    const id = node.id()
    if (id) {
        pushHistory() // Save state before Eraser
        analystStore.removeDrawing(id)
        node.destroy()
        tx?.nodes([]) // Clear selection if erased while selected
        renderDrawings()
      }
    return
  }

  if (currentTool.value === 'select') {
    const pos = st.getPointerPosition()
    if (pos) {
       const node = st.getIntersection(pos)
       if (!node || (node as any) === st) {
         tx?.nodes([])
       }
    }
    return
  }

  pushHistory() // Save state before creating new Shape
  isDrawing.value = true
  const pos = getPointerPos()
  if (!pos) return
  startPos = pos

  tx?.nodes([])

  const commonProps = {
    stroke: color.value,
    strokeWidth: 2,
    draggable: false,
    strokeScaleEnabled: false
  }

  if (currentTool.value === 'pencil') {
    currentShape = new Konva.Line({
      ...commonProps,
      points: [pos.x, pos.y, pos.x, pos.y],
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.5
    })
  } else if (currentTool.value === 'line') {
    currentShape = new Konva.Line({
      ...commonProps,
      points: [pos.x, pos.y, pos.x, pos.y]
    })
  } else if (currentTool.value === 'arrow' || currentTool.value === 'curved-arrow' || currentTool.value === 'dashed-arrow') {
    currentShape = new Konva.Arrow({
      ...commonProps,
      points: [pos.x, pos.y, pos.x, pos.y],
      pointerLength: 10,
      pointerWidth: 10,
      fill: color.value,
      dash: currentTool.value === 'dashed-arrow' ? [10, 5] : undefined
    })
  } else if (currentTool.value === 'rect') {
    currentShape = new Konva.Rect({
      ...commonProps,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      fill: isFilled.value ? hexToRgba(color.value, 0.25) : 'transparent'
    })
  } else if (currentTool.value === 'poly') {
    // Zone tool
     currentShape = new Konva.Line({
      ...commonProps,
      points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
      closed: true,
      fill: hexToRgba(color.value, 0.3),
    })
  } else if (currentTool.value === 'circle') {
    currentShape = new Konva.Circle({
      ...commonProps,
      x: pos.x,
      y: pos.y,
      radius: 0,
      fill: isFilled.value ? hexToRgba(color.value, 0.25) : 'transparent'
    })
  } else if (currentTool.value === 'triangle') {
    currentShape = new Konva.RegularPolygon({
      ...commonProps,
      x: pos.x,
      y: pos.y,
      sides: 3,
      radius: 0,
      fill: isFilled.value ? hexToRgba(color.value, 0.25) : 'transparent'
    })
  } else if (currentTool.value === 'text') {
      isTypingText.value = true
      textInputPos.value = { x: pos.x, y: pos.y }
      textInputValue.value = ''
      isDrawing.value = false
      setTimeout(() => textInputRef.value?.focus(), 50)
      return
  } else if (currentTool.value === 'marker') {
    currentShape = new Konva.Group({
      x: pos.x,
      y: pos.y,
      id: `temp_${Date.now()}`,
      name: 'pulsing-marker',
      draggable: false
    })
    
    const core = new Konva.Circle({
      radius: 4,
      fill: color.value,
      name: 'marker-core'
    })
    
    const ring = new Konva.Circle({
      radius: 4,
      stroke: color.value,
      strokeWidth: 2,
      name: 'marker-ring',
      opacity: 0.5
    })
    
    const group = currentShape as Konva.Group
    group.add(ring)
    group.add(core)
  } else if (currentTool.value === 'spotlight') {
    currentShape = new Konva.Group({
      x: 0,
      y: 0,
      id: `temp_${Date.now()}`,
      name: 'pulsing-spotlight',
      draggable: false
    })

    const beam = new Konva.Line({
      points: [pos.x - 1, pos.y, pos.x + 1, pos.y, pos.x + 1, 0, pos.x - 1, 0],
      closed: true,
      fillLinearGradientStartPoint: { x: pos.x, y: pos.y },
      fillLinearGradientEndPoint: { x: pos.x, y: 0 },
      fillLinearGradientColorStops: [0, hexToRgba(color.value, 0.4), 1, hexToRgba(color.value, 0.0)],
      name: 'spotlight-beam',
      strokeWidth: 0
    })
    
    const baseEllipse = new Konva.Ellipse({
      x: pos.x,
      y: pos.y,
      radiusX: 1,
      radiusY: 0.5,
      fill: hexToRgba(color.value, 0.1),
      stroke: color.value,
      strokeWidth: 2,
      strokeScaleEnabled: false,
      shadowColor: color.value,
      shadowBlur: 15,
      name: 'spotlight-base'
    })

    const group = currentShape as Konva.Group
    group.add(beam)
    group.add(baseEllipse)
  }

  if (currentShape) {
    ml.add(currentShape)
  }
}

const handleMouseMove = () => {
  const ml = mainLayer.value
  if (!isDrawing.value || !stage.value || !currentShape || !ml) return

  const pos = getPointerPos()
  if (!pos) return

  if (currentTool.value === 'pencil') {
    const line = currentShape as Konva.Line
    const newPoints = line.points().concat([pos.x, pos.y])
    line.points(newPoints)
  } else if (['line', 'dashed-line', 'arrow', 'curved-arrow', 'dashed-arrow'].includes(currentTool.value)) {
    const line = currentShape as Konva.Line
    
    if (currentTool.value === 'curved-arrow') {
      const midX = (startPos.x + pos.x) / 2
      const midY = (startPos.y + pos.y) / 2 - 20 
      line.points([startPos.x, startPos.y, midX, midY, pos.x, pos.y])
    } else {
      line.points([startPos.x, startPos.y, pos.x, pos.y])
    }
  } else if (currentTool.value === 'poly') {
    const line = currentShape as Konva.Line
    // Rectangular poly for zones (drag-based)
    line.points([
      startPos.x, startPos.y, 
      pos.x, startPos.y, 
      pos.x, pos.y, 
      startPos.x, pos.y
    ])
  } else if (currentTool.value === 'circle' || currentTool.value === 'marker') {
    if (currentTool.value === 'circle') {
      const circle = currentShape as Konva.Circle
      const dx = pos.x - (circle.x() || 0)
      const dy = pos.y - (circle.y() || 0)
      circle.radius(Math.sqrt(dx * dx + dy * dy))
    } else {
      const group = currentShape as Konva.Group
      const ring = group.findOne('.marker-ring') as Konva.Circle
      const dx = pos.x - group.x()
      const dy = pos.y - group.y()
      const r = Math.sqrt(dx * dx + dy * dy)
      ring.radius(r)
    }
  } else if (currentTool.value === 'text') {
    const textNode = currentShape as Konva.Text
    textNode.x(pos.x)
    textNode.y(pos.y)
  } else if (currentTool.value === 'rect') {
    const rect = currentShape as Konva.Rect
    const dx = pos.x - startPos.x
    const dy = pos.y - startPos.y
    rect.width(Math.abs(dx) || 0)
    rect.height(Math.abs(dy) || 0)
    rect.x(Math.min(pos.x, startPos.x))
    rect.y(Math.min(pos.y, startPos.y))
  } else if (currentTool.value === 'triangle') {
    const poly = currentShape as Konva.RegularPolygon
    const dx = pos.x - (poly.x() || 0)
    const dy = pos.y - (poly.y() || 0)
    poly.radius(Math.sqrt(dx * dx + dy * dy))
  } else if (currentTool.value === 'spotlight') {
    const group = currentShape as Konva.Group
    const beam = group.findOne('.spotlight-beam') as Konva.Line
    const base = group.findOne('.spotlight-base') as Konva.Ellipse
    
    if (beam && base) {
      const dx = Math.abs(pos.x - startPos.x)
      const baseRadiusX = Math.max(dx, 5)
      const baseRadiusY = baseRadiusX * 0.35 // Perspective ratio

      base.radiusX(baseRadiusX)
      base.radiusY(baseRadiusY)
      
      const baseY = startPos.y
      const topY = 0 // Fixed to the top of the canvas for the beam origin

      beam.fillLinearGradientStartPoint({ x: startPos.x, y: baseY })
      beam.fillLinearGradientEndPoint({ x: startPos.x, y: topY })

      // Generate trapezoid for beam (Base is wide, top connects above visually straight or slightly narrow)
      beam.points([
        startPos.x - baseRadiusX, baseY,
        startPos.x + baseRadiusX, baseY,
        startPos.x + (baseRadiusX * 0.7), topY,
        startPos.x - (baseRadiusX * 0.7), topY
      ])
    }
  }

  ml.batchDraw()
}

const finalizeText = () => {
    const ml = mainLayer.value
    if (!isTypingText.value || !stage.value || !ml) return
    const val = textInputValue.value.trim()
    
    if (val.length > 0) {
        const finalId = `draw_${Date.now()}`
        const textNode = new Konva.Text({
            id: finalId,
            x: textInputPos.value.x,
            y: textInputPos.value.y,
            text: val.toUpperCase(),
            fontSize: 22,
            fontFamily: 'Outfit, Inter, sans-serif',
            fontStyle: 'bold',
            fill: color.value,
            stroke: 'black',
            strokeWidth: 0.5,
            draggable: false,
            align: 'center'
        })

        ml.add(textNode)
        analystStore.addDrawing({
            clipId: props.activeClipId,
            time: props.currentTime,
            data: textNode.toJSON(),
            keyframes: [],
            duration: defaultDuration.value
        })
        textNode.destroy() // Let the store-based renderer take over
        renderDrawings()
    }

    isTypingText.value = false
    textInputValue.value = ''
}

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const handleMouseUp = () => {
  const ml = mainLayer.value
  if (!isDrawing.value || !currentShape || !ml || !stage.value) return
  isDrawing.value = false

  let isValid = true
  if (currentShape instanceof Konva.Circle && currentShape.radius() < 5) isValid = false
  if (currentShape instanceof Konva.Rect && Math.abs(currentShape.width()) < 5) isValid = false
  if (currentShape instanceof Konva.RegularPolygon && currentShape.radius() < 5) isValid = false
  
  // Spotlight validation
  if (currentShape instanceof Konva.Group) {
      const base = currentShape.findOne('.spotlight-base') as Konva.Ellipse
      if (base && base.radiusX() < 5) isValid = false
  }

  if (isValid) {
    const finalId = `draw_${Date.now()}`
    currentShape.id(finalId)
    
    analystStore.addDrawing({
      clipId: props.activeClipId,
      time: props.currentTime,
      data: currentShape.toJSON(),
      keyframes: [],
      duration: defaultDuration.value
    })
  }

  currentShape.destroy()
  currentShape = null
  renderDrawings()
}

const updateShapeInStore = (node: any) => {
  const drawId = node.id()
  const drawingIndex = analystStore.drawings.findIndex((d: any) => (d.id || `draw_${d.time}`) === drawId)
  if (drawingIndex !== -1) {
    const d = analystStore.drawings[drawingIndex]
    if (d) {
        d.data = node.toJSON()
        d.time = props.currentTime
     }
  }
  
  localStorage.setItem('edapp_analyst_drawings', JSON.stringify(analystStore.drawings))
}

const interpolateJSON = (jsonStart: string, jsonEnd: string, tRatio: number): string => {
   try {
     const s1 = JSON.parse(jsonStart)
     const s2 = JSON.parse(jsonEnd)
     const a1 = s1.attrs
     const a2 = s2.attrs
     
     const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * tRatio
     const getNum = (obj: any, key: string, def: number) => typeof obj[key] === 'number' ? obj[key] : def
     
     a1.x = lerp(getNum(a1, 'x', 0), getNum(a2, 'x', 0))
     a1.y = lerp(getNum(a1, 'y', 0), getNum(a2, 'y', 0))
     a1.width = lerp(getNum(a1, 'width', 0), getNum(a2, 'width', 0))
     a1.height = lerp(getNum(a1, 'height', 0), getNum(a2, 'height', 0))
     a1.radius = lerp(getNum(a1, 'radius', 0), getNum(a2, 'radius', 0))
     a1.scaleX = lerp(getNum(a1, 'scaleX', 1), getNum(a2, 'scaleX', 1))
     a1.scaleY = lerp(getNum(a1, 'scaleY', 1), getNum(a2, 'scaleY', 1))
     a1.rotation = lerp(getNum(a1, 'rotation', 0), getNum(a2, 'rotation', 0))
     
     // Interpolate points array (lines, arrows)
     if(a1.points && a2.points && a1.points.length === a2.points.length) {
       a1.points = a1.points.map((p: number, i: number) => lerp(p, a2.points[i]!))
     }
     
     s1.attrs = a1
     return JSON.stringify(s1)
   } catch(e) {
     return jsonStart // fallback
   }
}

const renderDrawings = () => {
  const st = stage.value
  const ml = mainLayer.value
  const tx = transformer.value
  if (!st || !ml || preventRenderDrawings) return

  const selectedIds = tx?.nodes().map((n: any) => n.id()) || []
  
  const visibleDrawings = analystStore.drawings.filter(d => {
    if (d.clipId && d.clipId !== props.activeClipId) return false
    const DURATION = 0.5
    // Sync with AnalystView auto-pause threshold (0.1s) to ensure visibility during tactical pause
    return props.currentTime >= (d.time - 0.1) && props.currentTime <= d.time + DURATION
  })
  const visibleIds = new Set(visibleDrawings.map(d => d.id || `draw_${d.time}`))

  // 1. Destroy nodes that are no longer visible
  ml.getChildren((node: any) => node.className !== 'Transformer').forEach((n: any) => {
     const nid = n.id()
     if (!visibleIds.has(nid)) {
       if (selectedIds.includes(nid)) {
         tx?.nodes(tx.nodes().filter((tn: any) => tn.id() !== nid))
       }
       n.destroy()
     }
  })

  // 2. Set/Update visible drawings
  visibleDrawings.forEach(d => {
    const drawId = d.id || `draw_${d.time}`
    
    let nodeDataString = d.data
    const DURATION = 0.5

    // Keyframe interpolation logic
    if (d.keyframes && d.keyframes.length > 0) {
      const states = [{ time: d.time, data: d.data }, ...d.keyframes]
      let st1 = states[0]!
      let st2 = states[states.length - 1]!
      
      for (let i = 0; i < states.length - 1; i++) {
         const currentState = states[i]
         const nextState = states[i+1]
         if (currentState && nextState && props.currentTime >= currentState.time && props.currentTime <= nextState.time) {
            st1 = currentState
            st2 = nextState
            break
         }
      }
      
      if (st1 && st2) {
        if (props.currentTime > st2.time) {
           nodeDataString = st2.data
        } else if (st1.time !== st2.time) {
           const ratio = (props.currentTime - st1.time) / (st2.time - st1.time)
           nodeDataString = interpolateJSON(st1.data, st2.data, ratio)
        }
      }
    }

    try {
       const parsed = JSON.parse(nodeDataString)
       
       const existingNode = ml.findOne(`#${drawId}`)
       
       const applyStrokeScaleFalse = (n: any) => {
         if (n.setAttr) n.setAttr('strokeScaleEnabled', false)
         if (n.getChildren) n.getChildren().forEach(applyStrokeScaleFalse)
       }
       
       // Fade Out at the end
       const timeLeft = (d.time + DURATION) - props.currentTime
       let targetOpacity = 1
       if (timeLeft < 0.5) targetOpacity = Math.max(0, timeLeft / 0.5)
       
       if (existingNode) {
          existingNode.setAttrs(parsed.attrs)
          existingNode.id(drawId)
          existingNode.opacity(targetOpacity)
          applyStrokeScaleFalse(existingNode)

          if (parsed.attrs.name?.includes('pulsing-spotlight')) {
             if (existingNode instanceof Konva.Circle) existingNode.radius(parsed.attrs.radius * (Math.sin(props.currentTime * 12) * 0.15 + 0.85))
             else if (existingNode instanceof Konva.Group) existingNode.opacity(targetOpacity * (Math.sin(props.currentTime * 10) * 0.2 + 0.8))
          } else if (parsed.attrs.name?.includes('pulsing-marker') && existingNode instanceof Konva.Container) {
             const ring = existingNode.findOne('.marker-ring')
             if (ring) {
                const pulse = (Math.sin(props.currentTime * 8) * 0.3 + 0.7)
                ring.scale({ x: pulse, y: pulse })
                ring.opacity(targetOpacity * (1.2 - pulse))
             }
          }
       } else {
          const node = Konva.Node.create(parsed)
          node.draggable(currentTool.value === 'select')
          node.id(drawId)
          node.opacity(targetOpacity)
          applyStrokeScaleFalse(node)

          if (parsed.attrs.name?.includes('pulsing-spotlight')) {
             if (node instanceof Konva.Circle) node.radius(parsed.attrs.radius * (Math.sin(props.currentTime * 12) * 0.15 + 0.85))
             else if (node instanceof Konva.Group) node.opacity(targetOpacity * (Math.sin(props.currentTime * 10) * 0.2 + 0.8))
          } else if (parsed.attrs.name?.includes('pulsing-marker') && node instanceof Konva.Container) {
             const ring = node.findOne('.marker-ring')
             if (ring) {
                const pulse = (Math.sin(props.currentTime * 8) * 0.3 + 0.7)
                ring.scale({ x: pulse, y: pulse })
                ring.opacity(targetOpacity * (1.2 - pulse))
             }
          }
          ml.add(node)
       }
    } catch(e) {}
  })

  ml.batchDraw()
}

const clearFrame = () => {
  const tx = transformer.value
  const selectedIds = tx?.nodes().map((n: any) => n.id()) || []
  pushHistory()
  
  if (selectedIds.length > 0) {
    analystStore.drawings = analystStore.drawings.filter(d => !selectedIds.includes(d.id || `draw_${d.time}`))
  } else if (props.activeClipId) {
    analystStore.drawings = analystStore.drawings.filter(d => d.clipId !== props.activeClipId)
  }

  localStorage.setItem('edapp_analyst_drawings', JSON.stringify(analystStore.drawings))
  tx?.nodes([])
  renderDrawings()
  emit('frame-cleared')
}

watch(() => props.activeClipId, () => {
  transformer.value?.nodes([])
  renderDrawings()
})
watch(() => props.currentTime, renderDrawings)
watch(() => analystStore.drawings, renderDrawings, { deep: true })
watch(() => props.active, (val) => {
  if (val) setTimeout(handleResize, 50)
})

watch(currentTool, (newTool) => {
  const ml = mainLayer.value
  const tx = transformer.value
  if (!ml) return
  
  if (newTool === 'select') {
    ml.getChildren((node: any) => node.className !== 'Transformer').forEach((n: any) => n.draggable(true))
    containerRef.value && (containerRef.value.style.cursor = 'default')
  } else if (newTool === 'eraser') {
    ml.getChildren((node: any) => node.className !== 'Transformer').forEach((n: any) => n.draggable(false))
    tx?.nodes([])
    containerRef.value && (containerRef.value.style.cursor = 'crosshair') // or a custom eraser cursor
  } else {
    ml.getChildren((node: any) => node.className !== 'Transformer').forEach((n: any) => n.draggable(false))
    tx?.nodes([])
    containerRef.value && (containerRef.value.style.cursor = 'crosshair')
  }
  ml.batchDraw()
})

watch(color, (newColor) => {
  const tx = transformer.value
  const ml = mainLayer.value
  const nodes = tx?.nodes()
  if (nodes && nodes.length > 0) {
    nodes.forEach((n: any) => {
      if (n.className === 'Arrow') {
        n.setAttr('fill', newColor)
        n.setAttr('stroke', newColor)
      } else {
        n.setAttr('stroke', newColor)
      }
      
      if (n.attrs.fill && n.attrs.fill !== 'transparent') {
         if (n.attrs.name === 'pulsing-spotlight') {
           n.setAttr('fill', hexToRgba(newColor, 0.2))
           n.setAttr('shadowColor', newColor)
         } else if (n.className !== 'Arrow') {
           n.setAttr('fill', hexToRgba(newColor, 0.4))
         }
      }
      
      updateShapeInStore(n)
    })
    ml?.batchDraw()
  }
})

watch(isFilled, (filled) => {
  const tx = transformer.value
  const ml = mainLayer.value
  const nodes = tx?.nodes()
  if (nodes && nodes.length > 0) {
    nodes.forEach((n: any) => {
      if (['Circle', 'Rect', 'RegularPolygon'].includes(n.className)) {
        if (filled) {
          n.setAttr('fill', hexToRgba(n.attrs.stroke || color.value, 0.4))
        } else {
          n.setAttr('fill', 'transparent')
        }
        updateShapeInStore(n)
      }
    })
    ml?.batchDraw()
  }
})

const getStageScale = () => {
  return stage.value?.scale() || { x: 1, y: 1 }
}

defineExpose({
  getCanvasElement: () => containerRef.value?.querySelector('canvas'),
  clearHistoryStack: () => { historyStack.value = [] },
  clearCanvas,
  clearFrame
})

</script>

<template>
  <div class="absolute inset-0 z-10 pointer-events-auto overflow-hidden">
    <div ref="containerRef" class="w-full h-full"></div>

    <!-- Inline Text Input Overlay -->
    <div 
        v-if="isTypingText"
        class="absolute"
        :style="{ 
            left: (textInputPos.x * getStageScale().x) + 'px', 
            top: (textInputPos.y * getStageScale().y) + 'px',
            transform: 'translate(-50%, -50%)'
        }"
    >
        <textarea
            ref="textInputRef"
            v-model="textInputValue"
            class="bg-black/80 text-white border-2 border-primary rounded-lg p-2 font-bold uppercase text-lg outline-none min-w-[120px] max-w-[300px] shadow-2xl overflow-hidden resize-none"
            rows="1"
            placeholder="Escribir..."
            @blur="finalizeText"
            @keydown.enter.prevent="finalizeText"
            @keydown.esc.stop="isTypingText = false"
        ></textarea>
    </div>
  </div>
</template>

<style scoped>

.drawing-controls {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 12px;
  pointer-events: auto;
  align-items: center;
  width: auto;
}

.tools-group, .colors-group {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0;
}

button {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

button.active {
  background: #10b981;
  border-color: #34d399;
  color: white;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}
</style>
