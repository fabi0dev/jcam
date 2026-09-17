"use client";

import { useEffect, type RefObject } from "react";

interface UseCameraAudioParams {
  videoRef: RefObject<HTMLVideoElement | null>;
  isPip: boolean;
  isMuted: boolean;
}

export function useCameraAudio({
  videoRef,
  isPip,
  isMuted,
}: UseCameraAudioParams): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Em PiP o vídeo precisa ser "audível" (não mudo, volume > 0) para o Chrome
    // não suspender a mídia com a aba oculta e fechar a janela de PiP. Como a
    // stream agora tem áudio real da câmera, isso também deixa ouvir o ambiente
    // enquanto o PiP estiver aberto.
    if (isPip) {
      video.muted = false;
      video.volume = 1;
      return;
    }

    video.volume = isMuted ? 0 : 1;
    video.muted = isMuted;
  }, [isMuted, isPip, videoRef]);
}
