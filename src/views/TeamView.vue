<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import * as XLSX from 'xlsx'

interface Player {
  id: number;
  nombre: string;
  edad: number;
  lugarNacimiento: string;
  posicion: string;
  pieDominante: string;
  lateralidad: string;
  altura: number; // in cm
  peso: number;   // in kg
  foto?: string;
  heatmap?: string; // DataURL or URL
  videos?: { title: string, url: string }[];
  dorsal?: number;
}

const players = ref<Player[]>([])
const loading = ref(false)

// Persistence Layer
onMounted(() => {
  const savedPlayers = localStorage.getItem('edapp_team_players')
  if (savedPlayers) {
    try {
      players.value = JSON.parse(savedPlayers)
    } catch (e) {
      console.error('Error loading saved players:', e)
    }
  }
})

watch(players, (newVal) => {
  localStorage.setItem('edapp_team_players', JSON.stringify(newVal))
}, { deep: true })
const searchQuery = ref('')
const selectedPlayer = ref<Player | null>(null)
const isAddingPlayer = ref(false)
const isEditingProfile = ref(false)
const photoPreview = ref<string | null>(null)

const newPlayer = ref<Omit<Player, 'id'>>({
  nombre: '',
  edad: 20,
  lugarNacimiento: '',
  posicion: 'Delantero',
  pieDominante: 'Derecho',
  lateralidad: 'Derecha',
  altura: 180,
  peso: 75,
  foto: '',
  heatmap: '',
  videos: [],
  dorsal: 1
})

const editForm = ref<Player | null>(null)

const filteredPlayers = computed(() => {
  if (!searchQuery.value) return players.value
  return players.value.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    p.posicion.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const downloadTemplate = () => {
  const template = [
    { 
      Nombre: 'Lionel Messi', 
      Edad: 36, 
      Lugar_Nacimiento: 'Rosario, Argentina',
      Posicion: 'Delantero', 
      Pie_Dominante: 'Izquierdo',
      Lateralidad: 'Izquierda',
      Altura_cm: 170,
      Peso_kg: 72,
      Dorsal: 10,
      Foto: '' 
    }
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla Equipo")
  XLSX.writeFile(wb, "plantilla_equipo_edapp.xlsx")
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  loading.value = true
  const reader = new FileReader()
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('No sheets found')
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) throw new Error('Worksheet is undefined')
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)
      
      players.value = json.map((p, index) => ({
        id: index + 1,
        nombre: p.Nombre || p.nombre || 'Jugador',
        edad: p.Edad || p.edad || 0,
        lugarNacimiento: p.Lugar_Nacimiento || p.lugar_nacimiento || 'N/A',
        posicion: p.Posicion || p.posicion || 'N/A',
        pieDominante: p.Pie_Dominante || p.pie_dominante || 'Derecho',
        lateralidad: p.Lateralidad || p.lateralidad || 'Derecha',
        altura: p.Altura_cm || p.altura || 0,
        peso: p.Peso_kg || p.peso || 0,
        dorsal: p.Dorsal || p.dorsal || 0,
        foto: p.Foto || p.foto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.Nombre || index}&backgroundColor=transparent`
      }))
    } catch (err) {
      console.error('Error parsing excel:', err)
      alert('Error al leer el archivo. Asegúrate de usar el formato correcto.')
    } finally {
      loading.value = false
    }
  }

  reader.readAsArrayBuffer(file)
}



const openPlayerProfile = (player: Player) => {
  selectedPlayer.value = player
}

const closePlayerProfile = () => {
  selectedPlayer.value = null
}

const addPlayer = () => {
  const idValue = players.value.length > 0 ? Math.max(...players.value.map(p => p.id)) + 1 : 1
  players.value.push({
    ...newPlayer.value,
    id: idValue,
    foto: newPlayer.value.foto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newPlayer.value.nombre || 'new'}&backgroundColor=transparent`
  })
  isAddingPlayer.value = false
  photoPreview.value = null
  // Reset form
  newPlayer.value = {
    nombre: '',
    edad: 20,
    lugarNacimiento: '',
    posicion: 'Delantero',
    pieDominante: 'Derecho',
    lateralidad: 'Derecha',
    altura: 180,
    peso: 75,
    foto: '',
    heatmap: '',
    videos: [],
    dorsal: 1
  }
}

const handlePhotoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    newPlayer.value.foto = result
    photoPreview.value = result
  }
  reader.readAsDataURL(file)
}

const startEditing = () => {
  if (selectedPlayer.value) {
    editForm.value = { ...selectedPlayer.value }
    photoPreview.value = selectedPlayer.value.foto || null
    isEditingProfile.value = true
  }
}

const updatePlayer = () => {
  if (editForm.value) {
    const index = players.value.findIndex(p => p.id === editForm.value!.id)
    if (index !== -1) {
      players.value[index] = { ...editForm.value }
      selectedPlayer.value = { ...editForm.value }
    }
    isEditingProfile.value = false
    photoPreview.value = null
  }
}

const deletePlayer = (id: number) => {
  if (confirm('¿Estás seguro de que quieres eliminar a este jugador de la plantilla?')) {
    players.value = players.value.filter(p => p.id !== id)
    selectedPlayer.value = null
  }
}

const handleEditPhotoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !editForm.value) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    editForm.value!.foto = result
    photoPreview.value = result
  }
  reader.readAsDataURL(file)
}




</script>

<template>
  <div class="team-view grid grid-cols-12 gap-8 my-8 text-on-background">
    <div class="col-span-12 lg:col-span-9 space-y-8">
      <div class="flex justify-between items-center bg-surface-container p-6 rounded-xl border border-white/5 shadow-xl">
        <div>
          <h1 class="text-3xl font-black font-headline tracking-tighter uppercase text-primary">Plantilla del Primer Equipo</h1>
          <p class="text-xs font-label text-on-surface-variant mt-2 tracking-widest uppercase">Gestión de Unidad Élite</p>
        </div>
        <div class="flex gap-4">
          <input v-model="searchQuery" class="bg-surface-container-highest border-white/10 rounded-lg py-2 px-4 text-sm focus:ring-1 focus:ring-primary w-64 text-on-surface" placeholder="BUSCAR JUGADOR..."/>
          <label class="cursor-pointer bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary-container px-4 py-2 rounded-lg font-bold text-xs font-headline uppercase transition-colors tracking-widest">
            <input type="file" @change="handleFileUpload" accept=".xlsx,.xls" hidden />
            Cargar Excel
          </label>
        </div>
      </div>
      <div v-if="loading" class="py-20 text-center"><p class="text-primary font-headline animate-pulse">Cargando...</p></div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div @click="isAddingPlayer = true" class="aspect-[3/4] border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white/5 hover:bg-white/10 transition-all">
          <span class="material-symbols-outlined text-4xl text-outline mb-4">add</span>
          <span class="font-headline font-bold text-sm tracking-widest uppercase text-outline">Añadir Jugador</span>
        </div>
        <div v-for="player in filteredPlayers" :key="player.id" @click="openPlayerProfile(player)" class="group cursor-pointer aspect-[3/4] relative bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-white/5 hover:border-primary/50 transition-all">
          <img :src="player.foto" class="w-full h-[60%] object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"/>
          <div class="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/80 to-transparent"></div>
          <span class="absolute top-4 right-4 text-5xl font-black italic text-white/5 group-hover:text-primary/10">{{ player.dorsal }}</span>
          <div class="absolute bottom-6 left-6 right-6">
            <span class="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded bg-primary/10 text-primary">{{ player.posicion }}</span>
            <h3 class="text-xl font-bold font-headline uppercase text-white mt-2 mb-4">{{ player.nombre }}</h3>
            <div class="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div><span class="block text-sm font-bold">{{ player.edad }}</span><span class="text-[9px] text-outline uppercase font-label">Años</span></div>
              <div><span class="block text-sm font-bold">{{ player.altura }}</span><span class="text-[9px] text-outline uppercase font-label">CM</span></div>
              <div><span class="block text-sm font-bold">{{ player.peso }}</span><span class="text-[9px] text-outline uppercase font-label">KG</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-span-12 lg:col-span-3">
      <div class="bg-surface-container-low rounded-xl p-6 border border-white/5 shadow-xl sticky top-24">
        <h2 class="font-headline text-lg font-bold uppercase mb-6 text-on-background">Resumen Plantilla</h2>
        <div class="text-center bg-surface-container p-8 rounded-xl border border-white/5">
          <span class="text-5xl font-black text-on-background">{{ players.length }}</span>
          <p class="text-[10px] uppercase font-label text-outline tracking-widest mt-2">Jugadores</p>
        </div>
        <button @click="downloadTemplate" class="w-full mt-6 py-3 bg-surface-container border border-white/10 text-outline hover:text-primary font-headline text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">Descargar Plantilla Base</button>
      </div>
    </div>
  </div>

  <div v-if="selectedPlayer" class="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex p-4 lg:p-12 items-center justify-center">
    <div class="bg-surface border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
      <button @click="closePlayerProfile" class="absolute top-6 right-6 text-outline hover:text-error transition-colors z-[101]"><span class="material-symbols-outlined text-3xl">close</span></button>
      <div class="h-64 relative bg-surface-container-highest flex-shrink-0">
        <img :src="selectedPlayer.foto" class="absolute inset-0 w-full h-full object-cover opacity-50"/>
        <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent"></div>
        <div class="absolute bottom-6 left-8 flex gap-6 items-end">
          <img :src="selectedPlayer.foto" class="w-32 h-32 rounded-xl border border-white/10 object-cover shadow-xl"/>
          <div class="pb-2">
            <span class="text-xs font-bold tracking-widest uppercase px-2 py-1 bg-primary/20 text-primary rounded">{{ selectedPlayer.posicion }}</span>
            <h2 class="text-4xl font-black font-headline uppercase text-white mt-2">{{ selectedPlayer.nombre }}</h2>
          </div>
        </div>
      </div>
      <div class="flex-grow flex flex-col lg:flex-row gap-8 p-8 overflow-y-auto">
        <div class="w-full lg:w-1/3 flex flex-col gap-6">
          <div class="bg-surface-container p-6 rounded-xl border border-white/5">
            <h3 class="font-headline text-sm font-bold uppercase text-outline mb-4">Perfil</h3>
            <ul class="space-y-3 text-sm">
              <li class="flex justify-between border-b border-white/5 pb-2"><span class="text-outline uppercase text-xs font-bold font-label">Edad</span> <span class="text-white">{{ selectedPlayer.edad }}</span></li>
              <li class="flex justify-between border-b border-white/5 pb-2"><span class="text-outline uppercase text-xs font-bold font-label">Altura / Peso</span> <span class="text-white">{{ selectedPlayer.altura }}cm / {{ selectedPlayer.peso }}kg</span></li>
              <li class="flex justify-between border-b border-white/5 pb-2"><span class="text-outline uppercase text-xs font-bold font-label">Pie</span> <span class="text-white">{{ selectedPlayer.pieDominante }}</span></li>
              <li class="flex justify-between border-b border-white/5 pb-2"><span class="text-outline uppercase text-xs font-bold font-label">Origen</span> <span class="text-white">{{ selectedPlayer.lugarNacimiento }}</span></li>
            </ul>
          </div>
          <button @click="startEditing" class="py-3 bg-surface-container-highest border border-white/10 hover:border-primary/50 text-white font-headline text-xs font-bold uppercase tracking-widest rounded transition-all">Editar Perfil</button>
          <button @click="deletePlayer(selectedPlayer.id)" class="py-3 bg-error/10 border border-error/20 text-error hover:bg-error hover:text-white font-headline text-xs font-bold uppercase tracking-widest rounded transition-all">Eliminar Jugador</button>
        </div>
        <div class="w-full lg:w-2/3 flex flex-col gap-6">
           <div class="bg-surface-container rounded-xl p-6 border border-white/5 h-64 flex flex-col">
             <h3 class="font-headline text-sm font-bold uppercase text-outline mb-4 flex items-center gap-2">Mapa Calor</h3>
             <div class="flex-grow bg-[#0f172a] rounded relative flex items-center justify-center border border-white/5 overflow-hidden">
               <img v-if="selectedPlayer.heatmap" :src="selectedPlayer.heatmap" class="absolute w-full h-full object-cover opacity-80"/>
               <span v-else class="text-outline text-xs uppercase font-headline tracking-widest">Sin mapa de calor</span>
             </div>
           </div>
           <div class="bg-surface-container rounded-xl p-6 border border-white/5 flex-grow">
             <h3 class="font-headline text-sm font-bold uppercase text-outline mb-4">Audovisual</h3>
             <div class="grid grid-cols-2 gap-4">
                <div v-for="v in selectedPlayer.videos" :key="v.url" class="p-4 bg-surface-container-highest rounded border border-white/5 flex gap-4">
                  <span class="material-symbols-outlined text-secondary">play_circle</span>
                  <div><p class="text-sm font-bold">{{ v.title }}</p><a :href="v.url" class="text-[10px] text-secondary hover:underline uppercase font-headline">Ver Video</a></div>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  </div>
  
  <div v-if="isAddingPlayer || isEditingProfile" class="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex p-4 items-center justify-center overflow-y-auto">
    <div class="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden my-auto h-auto max-h-[90vh]">
      <div class="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-surface z-10">
        <h2 class="font-headline text-xl font-bold tracking-tight text-white uppercase">{{ isAddingPlayer ? 'Nuevo Jugador' : 'Editar Jugador' }}</h2>
        <button @click="isAddingPlayer ? isAddingPlayer = false : isEditingProfile = false" class="text-outline hover:text-error"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="p-6 space-y-6 overflow-y-auto">
        <div class="flex flex-col items-center gap-4">
          <img v-if="photoPreview" :src="photoPreview" class="w-24 h-24 rounded-full border border-white/10 object-cover"/>
          <span v-else class="w-24 h-24 rounded-full bg-surface-container-highest border border-white/10 material-symbols-outlined flex items-center justify-center text-4xl text-outline">person</span>
          <label class="cursor-pointer text-xs font-bold font-headline uppercase tracking-widest bg-surface-container px-4 py-2 rounded text-outline hover:text-primary border border-white/10">
            <input type="file" @change="isAddingPlayer ? handlePhotoUpload($event) : handleEditPhotoUpload($event)" accept="image/*" hidden />
            Seleccionar Foto
          </label>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm font-body">
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Nombre</label><input v-model="(isAddingPlayer ? newPlayer : editForm!).nombre" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Posición</label>
            <select v-model="(isAddingPlayer ? newPlayer : editForm!).posicion" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white">
              <option>Portero</option><option>Defensa</option><option>Centrocampista</option><option>Delantero</option>
            </select>
          </div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Dorsal</label><input v-model.number="(isAddingPlayer ? newPlayer : editForm!).dorsal" type="number" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Edad</label><input v-model.number="(isAddingPlayer ? newPlayer : editForm!).edad" type="number" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Altura (cm)</label><input v-model.number="(isAddingPlayer ? newPlayer : editForm!).altura" type="number" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Peso (kg)</label><input v-model.number="(isAddingPlayer ? newPlayer : editForm!).peso" type="number" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Pie Dominante</label>
            <select v-model="(isAddingPlayer ? newPlayer : editForm!).pieDominante" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"><option>Derecho</option><option>Izquierdo</option><option>Ambidiestro</option></select>
          </div>
          <div class="space-y-1"><label class="text-[10px] text-outline uppercase font-headline">Origen</label><input v-model="(isAddingPlayer ? newPlayer : editForm!).lugarNacimiento" class="w-full bg-surface-container border border-white/10 p-2 rounded text-white"/></div>
        </div>
        <button @click="isAddingPlayer ? addPlayer() : updatePlayer()" class="w-full mt-4 py-4 bg-primary text-on-primary-container hover:bg-primary-container font-headline font-bold uppercase tracking-widest text-xs rounded transition-colors shadow-lg">Guardar</button>
      </div>
    </div>
  </div>
</template>


