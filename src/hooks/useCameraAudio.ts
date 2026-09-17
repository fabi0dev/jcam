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

    video.volume = isMuted ? 0 : 1;
    video.muted = isPip ? false : isMuted;
  }, [isMuted, isPip, videoRef]);
}
