"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseMotionDetectionParams {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** 1 (pouco sensível) a 100 (muito sensível). */
  sensitivity: number;
  /** Tempo mínimo entre alertas, em ms. */
  cooldownMs?: number;
  onMotion: (ratio: number) => void;
}

// Resolução baixa: barata de processar e suficiente para detectar mudanças amplas.
const SAMPLE_W = 64;
const SAMPLE_H = 36;
const SAMPLE_INTERVAL_MS = 350;
// Diferença de luminância por pixel para considerá-lo "alterado".
const PIXEL_DIFF_THRESHOLD = 26;

export function useMotionDetection({
  videoRef,
  enabled,
  sensitivity,
  cooldownMs = 6000,
  onMotion,
}: UseMotionDetectionParams): void {
  const onMotionRef = useRef(onMotion);
  useEffect(() => {
    onMotionRef.current = onMotion;
  }, [onMotion]);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Sensibilidade alta => menor fração de área precisa mudar para alertar.
    const clamped = Math.min(100, Math.max(1, sensitivity));
    const areaThreshold = 0.34 - (clamped / 100) * 0.31; // ~0.34 (baixa) a ~0.03 (alta)

    let previous: Uint8ClampedArray | null = null;
    let lastAlert = 0;

    const interval = window.setInterval(() => {
      if (video.readyState < 2 || video.videoWidth === 0) return;

      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
      const current = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

      if (previous) {
        let changed = 0;
        for (let i = 0; i < current.length; i += 4) {
          const lumaNow = (current[i] + current[i + 1] + current[i + 2]) / 3;
          const lumaPrev = (previous[i] + previous[i + 1] + previous[i + 2]) / 3;
          if (Math.abs(lumaNow - lumaPrev) > PIXEL_DIFF_THRESHOLD) changed++;
        }

        const ratio = changed / (SAMPLE_W * SAMPLE_H);
        if (ratio > areaThreshold) {
          const now = Date.now();
          if (now - lastAlert > cooldownMs) {
            lastAlert = now;
            onMotionRef.current(ratio);
          }
        }
      }

      previous = current;
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [enabled, sensitivity, cooldownMs, videoRef]);
}
