<script setup lang="ts">
import { ref } from 'vue'
import { Brain, UploadCloud, FileSpreadsheet, PlayCircle, Loader2, CheckCircle2 } from 'lucide-vue-next'

const videoFile = ref<File | null>(null)
const dataFile = ref<File | null>(null)
const isAnalyzing = ref(false)
const analysisComplete = ref(false)
const progress = ref(0)
const logs = ref<string[]>([])

const handleVideoUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    videoFile.value = target.files[0] || null
  }
}

const handleDataUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    dataFile.value = target.files[0] || null
  }
}

const addLog = (msg: string) => {
  logs.value.push(msg)
}

const startAnalysis = async () => {
  if (!videoFile.value) return
  
  isAnalyzing.value = true
  analysisComplete.value = false
  progress.value = 0
  logs.value = []
  
  addLog('Iniciando pipeline de Computer Vision...')
  
  // Simulated processing sequence
  const steps = [
    { p: 15, msg: 'Extrayendo frames del video (60fps)...' },
    { p: 35, msg: 'Detectando jugadores (YOLOv8)...' },
    { p: 55, msg: 'Asignando IDs de tracking (ByteTrack)...' },
    { p: 75, msg: 'Procesando tracking data espacial...' },
    { p: 90, msg: 'Sincronizando con datos de rendimiento (Excel)...' },
    { p: 100, msg: 'Generando modelo analítico final...' }
  ]
  
  for (const step of steps) {
    await new Promise(r => setTimeout(r, 1500))
    progress.value = step.p
    addLog(step.msg)
  }
  
  setTimeout(() => {
    isAnalyzing.value = false
    analysisComplete.value = true
    addLog('✅ Análisis completado. El informe está listo.')
  }, 1000)
}

</script>

<template>
  <div class="ai-view">
    <header class="page-header">
      <div class="header-main">
        <div class="title-with-icon">
          <div class="icon-glow"><Brain :size="28" /></div>
          <h1>EDApp AI Engine</h1>
        </div>
        <span class="beta-badge">BETA v0.9</span>
      </div>
      <p>Sube el video del partido y los datos GPS/Estadísticos para generar un análisis táctico automatizado con Inteligencia Artificial.</p>
    </header>

    <div class="ai-grid">
      <!-- Upload Section -->
      <div class="upload-panel glass-card">
        <h3>Archivos de Entrada</h3>
        
        <div class="upload-zone" :class="{ 'has-file': videoFile }">
          <input type="file" @change="handleVideoUpload" accept="video/mp4,video/mov,video/webm" hidden id="vid-upload">
          <label for="vid-upload" class="upload-label">
             <div class="icon-circle" :class="{ 'success': videoFile }">
               <CheckCircle2 v-if="videoFile" :size="24" />
               <UploadCloud v-else :size="24" />
             </div>
             <div class="upload-text">
               <h4>{{ videoFile ? 'Video Seleccionado' : 'Subir Video Principal' }}</h4>
               <p>{{ videoFile ? videoFile.name : 'MP4, MOV hasta 4K' }}</p>
             </div>
             <button class="select-btn">{{ videoFile ? 'Cambiar' : 'Seleccionar' }}</button>
          </label>
        </div>

        <div class="upload-zone" :class="{ 'has-file': dataFile }">
          <input type="file" @change="handleDataUpload" accept=".xlsx,.csv" hidden id="data-upload">
          <label for="data-upload" class="upload-label">
             <div class="icon-circle" :class="{ 'success': dataFile }">
               <CheckCircle2 v-if="dataFile" :size="24" />
               <FileSpreadsheet v-else :size="24" />
             </div>
             <div class="upload-text">
               <h4>{{ dataFile ? 'Datos Seleccionados' : 'Tracking Data (Opcional)' }}</h4>
               <p>{{ dataFile ? dataFile.name : 'Excel o CSV (GPS/Instat)' }}</p>
             </div>
             <button class="select-btn">{{ dataFile ? 'Cambiar' : 'Seleccionar' }}</button>
          </label>
        </div>

        <button 
          class="run-ai-btn" 
          :disabled="!videoFile || isAnalyzing"
          @click="startAnalysis"
        >
          <div v-if="isAnalyzing" class="ai-running">
            <Loader2 :size="20" class="spin" />
            Procesando... {{ progress }}%
          </div>
          <div v-else class="ai-ready">
            <PlayCircle :size="20" />
            Iniciar Motor de IA
          </div>
        </button>
      </div>

      <!-- Processing Console -->
      <div class="console-panel glass-card">
         <div class="console-header">
           <div class="terminal-dots"><span></span><span></span><span></span></div>
           <span>Python Backend Output</span>
         </div>
         <div class="console-body">
           <div v-if="logs.length === 0" class="console-empty">
             > Esperando inicio del procesamiento...
           </div>
           <div v-else class="log-entries">
             <div v-for="(log, idx) in logs" :key="idx" class="log-line">
               <span class="timestamp">[{{ new Date().toISOString().substring(11, 19) }}]</span>
               <span class="msg" :class="{ 'success': log.includes('✅') }">{{ log }}</span>
             </div>
           </div>
         </div>
         
         <!-- Result Action -->
         <div v-if="analysisComplete" class="result-action">
           <div class="result-banner">
             <CheckCircle2 :size="20" color="#10b981" />
             <span>Modelos tácticos generados exitosamente.</span>
           </div>
           <button class="btn-primary" @click="$router.push('/stats')">
             Ver Dashboard de Resultados
           </button>
         </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 32px;
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-with-icon h1 {
  font-size: 32px;
  margin: 0;
  background: linear-gradient(to right, #fff, #c4b5fd);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.icon-glow {
  width: 56px;
  height: 56px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #8b5cf6;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
}

.beta-badge {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
}

.ai-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

/* Upload Panel */
.upload-panel {
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-panel h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
}

.upload-zone {
  border: 2px dashed rgba(255,255,255,0.1);
  border-radius: 12px;
  transition: all 0.3s;
}

.upload-zone:hover {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(139, 92, 246, 0.02);
}

.upload-zone.has-file {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
  border-style: solid;
}

.upload-label {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  cursor: pointer;
  width: 100%;
}

.icon-circle {
  width: 48px;
  height: 48px;
  background: rgba(255,255,255,0.05);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #94a3b8;
}

.icon-circle.success {
  background: #10b981;
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.upload-text {
  flex-grow: 1;
}

.upload-text h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
}

.upload-text p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.select-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.run-ai-btn {
  margin-top: auto;
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  border: none;
  padding: 16px;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
}

.run-ai-btn:disabled {
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
}

.run-ai-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(139, 92, 246, 0.6);
}

.ai-ready, .ai-running {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* Console Panel */
.console-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  background: rgba(0,0,0,0.4);
}

.console-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-family: monospace;
  font-size: 13px;
  color: #94a3b8;
}

.terminal-dots {
  display: flex;
  gap: 6px;
}

.terminal-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #475569;
}
.terminal-dots span:nth-child(1) { background: #ef4444; }
.terminal-dots span:nth-child(2) { background: #f59e0b; }
.terminal-dots span:nth-child(3) { background: #10b981; }

.console-body {
  flex-grow: 1;
  padding: 20px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-y: auto;
  min-height: 300px;
}

.console-empty {
  color: #475569;
}

.log-line {
  margin-bottom: 8px;
  display: flex;
  gap: 12px;
}

.timestamp {
  color: #8b5cf6;
  opacity: 0.8;
}

.msg {
  color: #cbd5e1;
}

.msg.success {
  color: #10b981;
  font-weight: 600;
}

.spin {
  animation: spin 1s linear infinite;
}

/* Result Action */
.result-action {
  padding: 20px;
  background: rgba(16, 185, 129, 0.05);
  border-top: 1px solid rgba(16, 185, 129, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: slideUp 0.4s ease-out;
}

.result-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #10b981;
  font-weight: 600;
  font-size: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 900px) {
  .ai-grid {
    grid-template-columns: 1fr;
  }
}
</style>
