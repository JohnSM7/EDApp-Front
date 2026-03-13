import type { Drawing } from '../store/analyst'

export async function recordVideoSegment(
  videoElement: HTMLVideoElement, 
  startTime: number, 
  endTime: number,
  drawings: Drawing[] = []
): Promise<{ blob: Blob, extension: string }> {
  const formats = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/webm;codecs=h264', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  const selected = formats.find(f => MediaRecorder.isTypeSupported(f.mime)) || { mime: 'video/webm', ext: 'webm' };

  return new Promise((resolve, reject) => {
    if (!videoElement) return reject(new Error('Referencia de video no válida.'));

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1920; 
    canvas.height = videoElement.videoHeight || 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (!ctx) return reject(new Error('No se pudo inicializar el contexto de dibujo.'));

    // Watchdog increased: 4x clip duration + 20s base
    const maxDuration = (endTime - startTime) * 4000 + 20000;
    const watchdog = setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera de grabación agotado. Asegúrate de que la pestaña esté activa y no cambies de ventana.'));
    }, maxDuration);

    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];
    let isProcessing = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    
    const cleanup = () => {
      clearTimeout(watchdog);
      stopLoop();
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch(e) { /* ignore */ }
      }
      videoElement.removeEventListener('seeked', onSeeked);
      videoElement.removeEventListener('playing', startLoop);
      videoElement.removeEventListener('pause', stopLoop);
    };

    const startLoop = () => {
      if (isProcessing) return;
      isProcessing = true;
      const loop = () => {
        if (!isProcessing) return;
        drawFrame();
        timerId = setTimeout(loop, 1000 / 30); // Force 30fps even in background
      };
      loop();
    };

    const stopLoop = () => {
      isProcessing = false;
      if (timerId) clearTimeout(timerId);
    };

    const drawFrame = () => {
      if (!ctx) return;
      
      // 1. Draw Video
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // 2. Composite Drawings
      const currentTime = videoElement.currentTime;
      const VISIBILITY_WINDOW = 0.8;
      
      drawings.forEach(drawing => {
        const diff = Math.abs(drawing.time - currentTime);
        if (diff < VISIBILITY_WINDOW) {
          ctx.globalAlpha = Math.max(0, 1 - (diff / VISIBILITY_WINDOW));
          renderDrawing(ctx, drawing);
        }
      });
      ctx.globalAlpha = 1;
    };

    const onSeeked = () => {
      videoElement.removeEventListener('seeked', onSeeked);
      
      let stream: MediaStream;
      try {
        // Capture canvas stream
        stream = (canvas as any).captureStream(30);
        
        // Try to add original audio
        const videoStream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : (videoElement as any).mozCaptureStream ? (videoElement as any).mozCaptureStream() : null;
        if (videoStream) {
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        }
      } catch (e) {
        cleanup();
        return reject(new Error('Error de seguridad al capturar el flujo de video/audio.'));
      }

      recorder = new MediaRecorder(stream, { 
        mimeType: selected.mime,
        videoBitsPerSecond: 6000000 
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selected.mime });
        resolve({ blob, extension: selected.ext });
      };

      recorder.start();
      videoElement.play().then(() => {
        startLoop();
        videoElement.addEventListener('playing', startLoop);
        videoElement.addEventListener('pause', stopLoop);

        const checkEnd = setInterval(() => {
          if (videoElement.currentTime >= endTime || videoElement.ended) {
            clearInterval(checkEnd);
            cleanup();
          }
        }, 100);
      }).catch(err => {
        cleanup();
        reject(err);
      });
    };

    videoElement.addEventListener('seeked', onSeeked);
    setTimeout(() => { videoElement.currentTime = startTime; }, 150); // Increased seek delay
  });
}

function renderDrawing(ctx: CanvasRenderingContext2D, drawing: Drawing) {
  const canvas = ctx.canvas;
  const scaleX = canvas.width / (drawing.baseWidth || canvas.width);
  const scaleY = canvas.height / (drawing.baseHeight || canvas.height);
  const scaleAvg = (scaleX + scaleY) / 2;

  ctx.strokeStyle = drawing.color;
  ctx.fillStyle = drawing.color;
  ctx.lineWidth = 6 * scaleAvg; // Dynamic line width
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  
  if (drawing.tool === 'pencil' && drawing.points && drawing.points[0]) {
    ctx.moveTo(drawing.points[0].x * scaleX, drawing.points[0].y * scaleY);
    drawing.points.forEach(p => ctx.lineTo(p.x * scaleX, p.y * scaleY));
    ctx.stroke();
  } else if (drawing.points && drawing.points.length >= 2) {
    const p1 = { x: drawing.points[0]!.x * scaleX, y: drawing.points[0]!.y * scaleY };
    const p2 = { x: drawing.points[drawing.points.length - 1]!.x * scaleX, y: drawing.points[drawing.points.length - 1]!.y * scaleY };
    
    if (drawing.tool === 'line') {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (drawing.tool === 'rect') {
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (drawing.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (drawing.tool === 'arrow') {
      const headlen = 25 * scaleAvg;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headlen * Math.cos(angle - Math.PI / 6), p2.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p2.x - headlen * Math.cos(angle + Math.PI / 6), p2.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }
}
