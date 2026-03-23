export async function recordVideoSegment(
  videoElement: HTMLVideoElement, 
  startTime: number, 
  endTime: number,
  overlayCanvas: HTMLCanvasElement | null = null,
  clipInfo: { name: string, description?: string } | null = null
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
    };

    const stopLoop = () => {
      isProcessing = false;
      if (timerId) clearTimeout(timerId);
    };

    const drawFrame = () => {
      if (!ctx) return;
      
      // 1. Draw strict native video backing
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // 2. Composite Live DOM Konva WebGL Canvas directly on top matching dimensions precisely
      if (overlayCanvas) {
         ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
      }
      
      const currentTime = videoElement.currentTime;

      // 3. Draw Tactical Clip Title Overlay (Bottom Left, matching platform design)
      if (clipInfo && currentTime >= startTime && currentTime <= endTime) {
         // ... (existing title drawing)
         // (I'll keep the previous title drawing logic and just append the pause indicator part)
         let alpha = 1;
         const timeIn = currentTime - startTime;
         const timeToEnd = endTime - currentTime;
         if (timeIn < 0.5) alpha = timeIn / 0.5;
         else if (timeToEnd < 0.5) alpha = timeToEnd / 0.5;
         ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
         
         const padX = 24;
         const padY = 16;
         const margin = 50; 
         ctx.font = 'bold 36px Outfit, Inter, sans-serif'; 
         const textWidth = ctx.measureText(clipInfo.name.toUpperCase()).width;
         ctx.font = '20px Outfit, Inter, sans-serif';
         let descWidth = 0;
         if (clipInfo.description) descWidth = ctx.measureText(clipInfo.description).width;
         const boxWidth = Math.max(textWidth, descWidth) + padX * 2 + 10;
         const boxHeight = clipInfo.description ? 100 : 70;
         const boxX = margin;
         const boxY = canvas.height - boxHeight - margin;
         
         ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
         ctx.beginPath();
         ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12);
         ctx.fill();
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
         ctx.lineWidth = 1;
         ctx.stroke();
         ctx.fillStyle = '#10b981';
         ctx.fillRect(boxX, boxY + 12, 4, boxHeight - 24);
         ctx.fillStyle = '#ffffff';
         ctx.font = 'bold 36px Outfit, Inter, sans-serif';
         ctx.textAlign = 'left';
         ctx.textBaseline = 'top';
         ctx.fillText(clipInfo.name.toUpperCase(), boxX + padX, boxY + padY); 
         if (clipInfo.description) {
           ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
           ctx.font = '20px Outfit, Inter, sans-serif';
           ctx.fillText(clipInfo.description, boxX + padX, boxY + padY + 45);
         }
         ctx.globalAlpha = 1;

         // ADDED: Tactical Pause Indicator (Red Bubble at top)
         // We detect if it's paused by checking videoElement.paused
         // During export, pauses are predominantly the tactical 3s pauses
         if (videoElement.paused && !videoElement.ended) {
            const pauseText = "PAUSA TÁCTICA (3S)";
            ctx.font = 'bold 24px Outfit, Inter, sans-serif';
            const pWidth = ctx.measureText(pauseText).width;
            const pPadX = 30;
            const pBoxW = pWidth + pPadX * 2;
            const pBoxH = 48;
            const pX = (canvas.width - pBoxW) / 2;
            const pY = 60;

            // Pulsing effect using real time
            const pulse = (Math.sin(Date.now() / 200) * 0.15 + 0.85);
            ctx.globalAlpha = pulse;

            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Tailwind red-500
            ctx.beginPath();
            ctx.roundRect(pX, pY, pBoxW, pBoxH, 24);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pauseText, pX + pBoxW / 2, pY + pBoxH / 2);
            
            ctx.globalAlpha = 1;
         }
      }
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

    const onSeeked = () => {
      videoElement.removeEventListener('seeked', onSeeked);
      
      let stream: MediaStream;
      try {
        stream = (canvas as any).captureStream(30);
        
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
    setTimeout(() => { videoElement.currentTime = startTime; }, 150); 
  });
}
