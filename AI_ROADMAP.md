# Roadmap y Arquitectura: Integración de Motor IA (Tracking y Visión Computacional)

Este documento define la estrategia técnica para la próxima fase de **EDApp**: Integrar un servidor externo dedicado a la Inteligencia Artificial (Computer Vision) que complementará nuestro frontend desarrollado en Vue.js.

## 🎯 Objetivo Principal
Implementar un sistema de seguimiento automático ("Player Tracking") sobre el video subido por el analista usando modelos de aprendizaje profundo (Deep Learning). La IA deberá ser capaz de identificar jugadores, el balón y el árbitro, y devolver dicha información a nuestra aplicación para su visualización y análisis de datos.

---

## 🏗️ Arquitectura de la Solución (Cliente-Servidor)

Actualmente, **EDApp-Front** es un cliente puramente web. Puesto que los navegadores no tienen la potencia para procesar modelos grandes de visión computacional, debemos delegar este trabajo a un backend dedicado de Python.

![Arquitectura Propuesta](https://via.placeholder.com/800x400.png?text=EDApp-Front+(Vue)+<---(+REST+API+)--->+Backend+IA+(Python))

### 1. El Frontend (Vue.js - EDApp-Front)
- **Vista Principal:** `src/views/AiAnalysisView.vue`
- **Responsabilidad:** Actúa como la "Consola de Control". El usuario selecciona el archivo de video (MP4/MOV) del partido y los datos GPS o estadísticos (CSV/Excel).
- Al pulsar el botón "Iniciar Motor de la IA", envía los archivos mediante una petición HTTP (POST multipart) al servidor Python.
- Recibe un progreso asíncrono (WebSockets/Polling) para mostrar el log en la terminal virtual de la interfaz.

### 2. El Backend del Motor IA (Python)
- **Tecnologías recomendadas:** `FastAPI` (muy rápido y asíncrono) o `Flask`.
- **Hardware requerido:** Una GPU compatible con CUDA (Nvidia) o un servicio Cloud (como AWS EC2, Google Cloud, Paperspace) para lograr inferencia en tiempos razonables.
- **Flujo Interno:**
  1. Recibe el video del frontend.
  2. Extrae todos los fotogramas secuencialmente.
  3. Ejecuta la detección y el seguimiento.
  4. Agrega/Superpone los datos estadísticos opcionales del GPS/Excel.
  5. Retorna los resultados.

---

## 🧠 Modelos y Tecnologías del Motor IA

Para lograr resultados profesionales a la par con empresas especializadas, se recomiendan los siguientes componentes de código abierto en la capa de Inteligencia Artificial:

### A. Detección de Objetos (Object Detection)
**Modelo:** `YOLOv8` (Ultralytics) o `YOLO-NAS`.
- **Por qué:** Son el estándar actual de rapidez y precisión.
- **Función:** Detectar cajas delimitadoras (*Bounding Boxes*) alrededor de: `Jugador_Equipo_A`, `Jugador_Equipo_B`, `Balon`, `Arbitro`.

### B. Seguimiento Multi-Objeto (Multi-Object Tracking - MOT)
**Modelos:** `ByteTrack`, `DeepSORT` o `BoT-SORT`.
- **Por qué:** YOLOv8 detecta objetos de forma individual en cada fotograma pero no "recuerda" quién era quién en el fotograma siguiente. Un *Tracker* asigna un ID único (ej. ID 12) a un jugador de forma continua, incluso cuando se cruza.

### C. Perspectiva y Radar (Opcional - Avanzado)
**Herramientas:** `OpenCV`, Transformación de Perspectiva (Homografía).
- **Por qué:** Permite transformar las coordenadas del video en 2D (cámara inclinada) a una cancha táctica de vista superior 2D (mini-mapa tipo Radar).

---

## 📡 Contrato API Petición-Respuesta (Cómo nos comunicamos)

Para que el frontend interactúe mágicamente, aquí está el contrato propuesto que el backend debería devolver en formato JSON tras terminar el procesamiento:

**Método Recomendado: Devolver un JSON masivo de *Tracking Data*.**
De este modo, podemos dibujar los radares o recuadros *en tiempo real* en nuestro `<DrawingLayer>` basado en HTML5 Canvas, en lugar de descargar un MP4 entero ya pintado.

```json
{
  "match_id": "8347fnd-834nd",
  "fps": 30,
  "frames": [
    {
      "frame_idx": 1,
      "timestamp_ms": 33,
      "entities": [
        {
          "id": 1,
          "class": "Jugador",
          "team": "A",
          "bbox": [150, 400, 200, 520], // x1, y1, x2, y2
          "speed_kmh": 12.4
        },
        {
          "id": 2,
          "class": "Balon",
          "team": null,
          "bbox": [430, 230, 440, 240], // x1, y1, x2, y2
          "speed_kmh": 45.2
        }
      ]
    }
  ]
}
```

Al recibir esto, Vue.js leería `timestamp_ms` durante la reproducción del video y dibujaría dinámicamente cuadros de colores nativos e interactivos donde el usuario puede pinchar.

---

## 📋 Pasos de Acción para el Equipo de Ciencias de Datos (Data Science / AI)

1. [ ] Inicializar un repositorio limpio (ej: `edapp-ai-backend`).
2. [ ] Crear un servidor básico en `FastAPI` e implementar los Endpoints de carga de video (`POST /api/v1/analyze`).
3. [ ] Implementar el pipeline local de **YOLOv8** + **ByteTrack** mediante un script en consola para una prueba inicial de concepto (PoC) sobre un clip recortado de 10 segundos.
4. [ ] Formatear las salidas de píxeles al esquema estructurado de JSON detallado arriba.
5. [ ] **Fusión:** Desarrollar en Vue.js un cliente para realizar llamadas `fetch` a este backend desde `AiAnalysisView.vue` para consumir los datos JSON resultantes.
