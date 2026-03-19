<script setup lang="ts">
import { useAuthStore } from '../store/auth'
import { Trophy, Users, BarChart } from 'lucide-vue-next'

const auth = useAuthStore()
</script>

<template>
  <div class="dashboard grid grid-cols-1 gap-8 my-8 text-on-background">
    <header class="flex flex-col gap-2 p-6 bg-surface-container rounded-xl border border-white/5 shadow-xl">
      <h1 class="text-3xl font-black font-headline tracking-tighter uppercase text-primary">Bienvenido, {{ auth.user?.name || 'Analista' }}</h1>
      <p class="text-xs font-label text-on-surface-variant tracking-widest uppercase">Resumen de actividad de tu equipo para esta temporada.</p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-surface-container-low p-6 rounded-xl border border-white/5 shadow-2xl flex items-center gap-6 hover:border-primary/30 transition-colors">
        <div class="w-16 h-16 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
          <Trophy :size="32" />
        </div>
        <div>
          <h3 class="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Partidos Jugados</h3>
          <p class="text-4xl font-black text-white mt-1">12</p>
        </div>
      </div>

      <div class="bg-surface-container-low p-6 rounded-xl border border-white/5 shadow-2xl flex items-center gap-6 hover:border-primary/30 transition-colors">
        <div class="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Users :size="32" />
        </div>
        <div>
          <h3 class="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Plantilla</h3>
          <p class="text-4xl font-black text-white mt-1">22</p>
        </div>
      </div>

      <div class="bg-surface-container-low p-6 rounded-xl border border-white/5 shadow-2xl flex items-center gap-6 hover:border-primary/30 transition-colors">
        <div class="w-16 h-16 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
          <BarChart :size="32" />
        </div>
        <div>
          <h3 class="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Análisis Completados</h3>
          <p class="text-4xl font-black text-white mt-1">45</p>
        </div>
      </div>
    </div>

    <section class="bg-surface-container p-8 rounded-xl border border-white/5 mt-4">
      <h2 class="font-headline text-lg font-bold uppercase mb-6 text-on-background flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">history</span> Últimos Recortes
      </h2>
      <div class="flex flex-col items-center justify-center h-48 bg-surface-container-highest rounded-xl border border-white/5 border-dashed">
        <span class="material-symbols-outlined text-4xl text-outline mb-2">videocam_off</span>
        <p class="text-xs font-headline font-bold uppercase tracking-widest text-outline">No hay recortes recientes. Empieza a analizar un partido en el Modo Analista.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind CSS */
</style>
