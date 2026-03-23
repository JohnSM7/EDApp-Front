<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'

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
  <div class="ai-view grid grid-cols-1 md:grid-cols-12 gap-8 my-8 text-on-background h-auto lg:h-[calc(100vh-120px)]">
    <div class="col-span-12">
      <header class="flex flex-col gap-2 p-6 bg-surface-container rounded-xl border border-white/5 shadow-xl">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-tertiary/10 rounded-xl flex items-center justify-center text-tertiary shadow-[0_0_20px_rgba(203,166,247,0.3)]">
              <span class="material-symbols-outlined text-3xl">psychology</span>
            </div>
            <h1 class="text-3xl font-black font-headline tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-tertiary">EDApp AI Engine</h1>
          </div>
          <span class="bg-secondary/10 text-secondary border border-secondary/30 px-4 py-1.5 rounded-full text-xs font-bold font-headline tracking-widest uppercase shadow-[0_0_15px_rgba(245,158,11,0.2)]">BETA v0.9</span>
        </div>
        <p class="text-xs font-label text-on-surface-variant tracking-widest uppercase mt-2">Sube el video del partido y los datos GPS/Estadísticos para generar un análisis táctico automatizado con Inteligencia Artificial.</p>
      </header>
    </div>

    <!-- Upload Section -->
    <div class="col-span-12 lg:col-span-5 flex flex-col gap-6">
      <div class="bg-surface-container-low p-6 flex flex-col gap-6 rounded-xl border border-white/5 shadow-2xl h-full">
        <h3 class="font-headline text-lg font-bold uppercase tracking-widest text-on-surface border-b border-white/5 pb-4">Archivos de Entrada</h3>
        
        <div class="relative group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300" :class="videoFile ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-tertiary/50 hover:bg-tertiary/5'">
          <input type="file" @change="handleVideoUpload" accept="video/mp4,video/mov,video/webm" hidden id="vid-upload">
          <label for="vid-upload" class="flex items-center gap-6 p-6 cursor-pointer w-full h-full">
             <div class="w-12 h-12 rounded-full flex items-center justify-center transition-colors" :class="videoFile ? 'bg-primary text-on-primary-container shadow-[0_0_15px_rgba(105,246,184,0.4)]' : 'bg-surface-container-highest text-outline'">
               <span class="material-symbols-outlined text-2xl">{{ videoFile ? 'check_circle' : 'cloud_upload' }}</span>
             </div>
             <div class="flex-grow min-w-0">
               <h4 class="text-sm font-bold font-headline uppercase tracking-widest text-white mb-1 truncate">{{ videoFile ? 'Video Seleccionado' : 'Subir Video Principal' }}</h4>
               <p class="text-xs text-on-surface-variant truncate">{{ videoFile ? videoFile.name : 'MP4, MOV hasta 4K' }}</p>
             </div>
             <button class="shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-headline font-bold uppercase transition-colors text-white">{{ videoFile ? 'Cambiar' : 'Seleccionar' }}</button>
          </label>
        </div>

        <div class="relative group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300" :class="dataFile ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-tertiary/50 hover:bg-tertiary/5'">
          <input type="file" @change="handleDataUpload" accept=".xlsx,.csv" hidden id="data-upload">
          <label for="data-upload" class="flex items-center gap-6 p-6 cursor-pointer w-full h-full">
             <div class="w-12 h-12 rounded-full flex items-center justify-center transition-colors" :class="dataFile ? 'bg-primary text-on-primary-container shadow-[0_0_15px_rgba(105,246,184,0.4)]' : 'bg-surface-container-highest text-outline'">
               <span class="material-symbols-outlined text-2xl">{{ dataFile ? 'check_circle' : 'table' }}</span>
             </div>
             <div class="flex-grow min-w-0">
               <h4 class="text-sm font-bold font-headline uppercase tracking-widest text-white mb-1 truncate">{{ dataFile ? 'Datos Seleccionados' : 'Tracking Data (Opcional)' }}</h4>
               <p class="text-xs text-on-surface-variant truncate">{{ dataFile ? dataFile.name : 'Excel o CSV (GPS/Instat)' }}</p>
             </div>
             <button class="shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-headline font-bold uppercase transition-colors text-white">{{ dataFile ? 'Cambiar' : 'Seleccionar' }}</button>
          </label>
        </div>

        <button 
          class="mt-auto w-full py-5 rounded-xl text-white font-headline text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="!videoFile || isAnalyzing ? 'bg-surface-container-highest text-outline' : 'bg-gradient-to-r from-tertiary to-[#5c3c92] hover:scale-[1.02] shadow-[0_10px_30px_rgba(203,166,247,0.4)]'"
          :disabled="!videoFile || isAnalyzing"
          @click="startAnalysis"
        >
          <template v-if="isAnalyzing">
            <Loader2 :size="20" class="animate-spin" />
            <span>Procesando... {{ progress }}%</span>
          </template>
          <template v-else>
            <span class="material-symbols-outlined text-2xl">smart_toy</span>
            <span>Iniciar Motor de IA (YOLOv8)</span>
          </template>
        </button>
      </div>
    </div>

    <!-- Processing Console -->
    <div class="col-span-12 lg:col-span-7 h-full flex flex-col">
      <div class="bg-black/40 rounded-xl border border-white/5 shadow-2xl flex flex-col flex-grow overflow-hidden min-h-[400px]">
         <div class="flex items-center gap-4 px-6 py-4 bg-surface-container/50 border-b border-white/5">
           <div class="flex gap-2">
             <span class="w-3 h-3 rounded-full bg-error"></span>
             <span class="w-3 h-3 rounded-full bg-secondary"></span>
             <span class="w-3 h-3 rounded-full bg-primary"></span>
           </div>
           <span class="font-mono text-xs text-outline tracking-wider">Python Backend Terminal</span>
         </div>
         <div class="p-6 font-mono text-xs text-on-surface-variant flex-grow overflow-y-auto bg-transparent leading-relaxed custom-scrollbar">
           <div v-if="logs.length === 0" class="text-outline italic">
             > Esperando inicio del procesamiento remoto...
           </div>
           <div v-else class="space-y-2">
             <div v-for="(log, idx) in logs" :key="idx" class="flex gap-4 animate-[slideUp_0.3s_ease-out]">
               <span class="text-tertiary opacity-80 shrink-0">[{{ new Date().toISOString().substring(11, 19) }}]</span>
               <span :class="log.includes('✅') ? 'text-primary font-bold' : 'text-white/80'">{{ log }}</span>
             </div>
           </div>
         </div>
         
         <!-- Result Action -->
         <div v-if="analysisComplete" class="p-6 bg-primary/5 border-t border-primary/20 animate-[slideUp_0.4s_ease-out] flex flex-col gap-4">
           <div class="flex items-center gap-3 text-primary font-bold text-sm">
             <span class="material-symbols-outlined">check_circle</span>
             <span>Modelos tácticos y datos GPS generados exitosamente.</span>
           </div>
           <button class="self-start px-6 py-3 bg-primary text-on-primary-container hover:bg-primary-container rounded-lg font-headline text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(105,246,184,0.3)] transition-all" @click="$router.push('/stats')">
             Ver Dashboard de Resultados
           </button>
         </div>
      </div>
    </div>
  </div>
</template>
