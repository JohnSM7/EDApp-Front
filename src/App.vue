<script setup lang="ts">
import { useAuthStore } from './store/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout min-h-screen bg-surface text-on-background">
    <template v-if="auth.isAuthenticated">
      <!-- TopNavBar -->
      <nav class="fixed top-0 w-full z-50 bg-[#070e1d]/80 backdrop-blur-xl border-b border-primary/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex justify-between items-center px-6 h-16">
        <div class="flex items-center gap-8">
          <span class="text-2xl font-black tracking-tighter text-primary font-headline uppercase whitespace-nowrap">Analyst Studio</span>
          <div class="hidden md:flex gap-6 items-center">
            <router-link to="/" class="font-headline tracking-tight font-bold uppercase text-sm transition-colors text-outline hover:text-on-surface" active-class="text-primary border-b-2 border-primary pb-1">
              Inicio
            </router-link>
            <router-link to="/analyst" class="font-headline tracking-tight font-bold uppercase text-sm transition-colors text-outline hover:text-on-surface" active-class="text-primary border-b-2 border-primary pb-1">
              Consola
            </router-link>
            <router-link to="/my-team" class="font-headline tracking-tight font-bold uppercase text-sm transition-colors text-outline hover:text-on-surface" active-class="text-primary border-b-2 border-primary pb-1">
              Plantilla
            </router-link>
            <router-link to="/stats" class="font-headline tracking-tight font-bold uppercase text-sm transition-colors text-outline hover:text-on-surface" active-class="text-primary border-b-2 border-primary pb-1">
              Estadísticas
            </router-link>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="relative hidden lg:block">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input class="bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-xs font-headline tracking-widest focus:ring-1 focus:ring-primary w-64 uppercase placeholder:text-outline text-on-surface" placeholder="BUSCAR..." type="text"/>
          </div>
          <button class="p-2 text-on-surface-variant hover:bg-primary/10 transition-all duration-200 active:scale-95 rounded">
            <span class="material-symbols-outlined">notifications</span>
          </button>
          <button class="p-2 text-on-surface-variant hover:bg-primary/10 transition-all duration-200 active:scale-95 rounded">
            <span class="material-symbols-outlined">settings</span>
          </button>
          <div class="h-8 w-8 rounded bg-primary-container overflow-hidden border border-primary/20">
            <img alt="User Avatar" class="w-full h-full object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Analyst&backgroundColor=transparent"/>
          </div>
        </div>
      </nav>

      <!-- SideNavBar -->
      <aside class="fixed left-0 top-16 h-[calc(100vh-64px)] w-24 flex flex-col bg-[#0b1324] border-r border-white/5 z-40">
        <div class="flex flex-col items-center py-4 space-y-2 flex-grow">
          <router-link to="/analyst" class="flex flex-col items-center justify-center gap-1 text-outline hover:text-on-surface w-full py-4 transition-colors" active-class="!text-primary bg-primary/5 border-r-2 border-primary active:bg-primary/10">
            <span class="material-symbols-outlined">movie</span>
            <span class="font-headline text-[10px] font-medium uppercase tracking-widest">Clips</span>
          </router-link>
          
          <router-link to="/ai-analysis" class="flex flex-col items-center justify-center gap-1 text-outline hover:text-on-surface w-full py-4 transition-colors" active-class="!text-primary bg-primary/5 border-r-2 border-primary active:bg-primary/10">
            <span class="material-symbols-outlined">insights</span>
            <span class="font-headline text-[10px] font-medium uppercase tracking-widest">IA</span>
          </router-link>
        </div>
        
        <div class="pb-6 flex flex-col items-center space-y-4">
          <button class="text-outline hover:text-primary transition-colors">
            <span class="material-symbols-outlined">help</span>
          </button>
          <button @click="handleLogout" class="text-outline hover:text-error transition-colors">
            <span class="material-symbols-outlined">logout</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Canvas -->
      <main class="ml-24 mt-16 p-8 min-h-[calc(100vh-64px)] bg-surface">
        <router-view />
      </main>
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>

<style>
@import './styles/base.css';

/* Override base styles that could conflict with Tailwind */
body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100vh;
}
</style>
