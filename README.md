# EDApp - Football Intelligence Analysis Platform

![EDApp Banner](https://img.shields.io/badge/Aesthetics-Premium-blue?style=for-the-badge)
![Vue Version](https://img.shields.io/badge/Vue-3.x-4fc08d?style=for-the-badge&logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript)

EDApp es una plataforma avanzada de análisis táctico para equipos de fútbol, diseñada específicamente para ofrecer herramientas profesionales (análisis de video, gestión de datos y procesamiento con IA) a clubes modestos y equipos locales.

## 🚀 Proceso de Creación y Desarrollo

El desarrollo de EDApp se ha centrado en la **eficiencia reactiva** y una **estética premium**, siguiendo un flujo de trabajo de ingeniería moderno:

### 1. Definición de la Arquitectura
Se eligió **Vue 3 con Vite** por su excepcional velocidad de desarrollo y rendimiento en el manejo de estados complejos (necesario para el análisis de video).
- **Store**: Se utiliza **Pinia** para una gestión de estado centralizada (Auth, Datos del equipo).
- **Router**: **Vue Router** gestiona la navegación con guardias de seguridad para asegurar que solo usuarios autenticados accedan a los datos.
- **Iconografía**: **Lucide Vue Next** proporciona un set de iconos minimalista y moderno.

### 2. Diseño de Interfaz (UI/UX)
Para alejarse de las aplicaciones de gestión tradicionales y aburridas, se implementó un sistema de diseño basado en **Glassmorphism**:
- **Efecto Cristal**: Uso de `backdrop-filter: blur()` y bordes semitransparentes.
- **Paleta de Colores**: Un fondo "Deep Dark" (Slate-900/950) con acentos en azul eléctrico y verde esmeralda.
- **Tipografía**: Inter para máxima legibilidad.
- **Responsividad**: Diseño adaptable para tablets y desktops (centros de mando de analistas).

### 3. Implementación de Módulos Core

#### A. Sistema de Autenticación
- Pantalla de login diseñada para generar confianza inmediata.
- Flujo de sesión seguro que redirige automáticamente según el estado del usuario.

#### B. Módulo "Mi Equipo" (Data Parsing)
- Integración con la librería `XLSX` para permitir a los entrenadores cargar sus plantillas de jugadores directamente desde archivos Excel.
- Procesamiento en el cliente para mayor privacidad y rapidez.
- Generación dinámica de avatares y badges de posición.

#### C. Modo Analista (Video & Clipping)
- Desarrollo de un reproductor de video customizado.
- Estructura preparada para la "Botonera Táctica", permitiendo etiquetar eventos de juego en tiempo real.
- Integración planificada de Canvas API para dibujo y anotaciones sobre fotogramas congelados.

#### D. Dashboard Inteligente
- Tarjetas de métricas rápidas.
- Visualización de actividad reciente para un flujo de trabajo continuo entre sesiones.

## 🛠️ Tecnologías Utilizadas

- **Frontend Core**: [Vue.js 3](https://vuejs.org/) (Composition API)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Gestión de Estado**: [Pinia](https://pinia.vuejs.org/)
- **Estilo**: CSS Vanilla con Variables Dinámicas (Custom Properties)
- **Manipulación de Datos**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Gráficos**: [Chart.js](https://www.chartjs.org/) (Para el módulo de colectivos)

## 📦 Instalación y Ejecución

Para poner en marcha el centro de análisis localmente:

1. **Clonar el repositorio**:
   ```bash
   git clone <url-del-repo>
   cd EDApp-Front
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Ejecutar servidor de desarrollo**:
   ```bash
   npm run dev
   ```

## 📅 Hoja de Ruta (Roadmap)
- [ ] Implementar exportación de clips de video editados.
- [ ] Conexión vía API con el motor de IA en Python para detección automática de jugadores.
- [ ] Comparativa de rendimiento entre temporadas.
- [ ] Modo "Directo" para etiquetado durante el partido.

---
*Desarrollado por Tane Solutions*
