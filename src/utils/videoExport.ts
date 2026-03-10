export async function recordVideoSegment(videoElement: HTMLVideoElement, startTime: number, endTime: number): Promise<{ blob: Blob, extension: string }> {
  const formats = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/webm;codecs=h264', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  const selected = formats.find(f => MediaRecorder.isTypeSupported(f.mime)) || { mime: 'video/webm', ext: 'webm' };

  return new Promise((resolve, reject) => {
    if (!videoElement) return reject(new Error('Referencia de video no válida.'));

    // Safety watchdog: if the clip is X seconds, it shouldn't take more than X * 2 + 5 seconds
    const maxDuration = (endTime - startTime) * 2 + 5000;
    const watchdog = setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera de grabación agotado. Asegúrate de que la pestaña esté activa.'));
    }, maxDuration > 30000 ? maxDuration : 30000);

    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];
    
    const cleanup = () => {
      clearTimeout(watchdog);
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch(e) {}
      }
      videoElement.removeEventListener('seeked', onSeeked);
    };

    const onSeeked = () => {
      videoElement.removeEventListener('seeked', onSeeked);
      
      let stream;
      try {
        stream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : (videoElement as any).mozCaptureStream ? (videoElement as any).mozCaptureStream() : null;
      } catch (e) {
        cleanup();
        return reject(new Error('Error de seguridad al acceder al stream del video.'));
      }

      if (!stream) {
        cleanup();
        return reject(new Error('Captura de video no soportada.'));
      }

      recorder = new MediaRecorder(stream, { 
        mimeType: selected.mime,
        videoBitsPerSecond: 4000000 // optimized to 4Mbps for ZIP size
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selected.mime });
        resolve({ blob, extension: selected.ext });
      };

      recorder.start();
      videoElement.play().then(() => {
        // We use setInterval instead of RAF for better background resilience
        const interval = setInterval(() => {
          if (videoElement.currentTime >= endTime || videoElement.ended) {
            clearInterval(interval);
            clearTimeout(watchdog);
            videoElement.pause();
            if (recorder && recorder.state === 'recording') recorder.stop();
          }
        }, 100);
      }).catch(err => {
        cleanup();
        reject(err);
      });
    };

    videoElement.addEventListener('seeked', onSeeked);
    
    // Some browsers need a tiny delay before seeking for recording
    setTimeout(() => {
      videoElement.currentTime = startTime;
    }, 50);
  });
}
