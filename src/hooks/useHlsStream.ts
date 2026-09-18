"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Hls from "hls.js";

export type StreamStatus = "connecting" | "online" | "offline";

interface UseHlsStreamResult {
  status: StreamStatus;
  error: string | null;
  connect: () => void;
}

const HLS_CONFIG: Partial<Hls["config"]> = {
  enableWorker: true,
  lowLatencyMode: true,
  // Sentar ~1s atrás da borda (2 segmentos de 0,5s) em vez de 1,5s.
  liveSyncDurationCount: 2,
  // Teto de latência baixo: passou disto, o player pula pra frente.
  liveMaxLatencyDurationCount: 4,
  // Em vez de deixar a latência acumular até o teto, acelera até 1,5x
  // para recuperar o atraso suavemente e voltar pra borda ao vivo.
  maxLiveSyncPlaybackRate: 1.5,
  // Sem back buffer: não segura mídia já reproduzida.
  backBufferLength: 0,
  maxBufferLength: 4,
  maxMaxBufferLength: 8,
  manifestLoadingMaxRetry: 8,
  levelLoadingMaxRetry: 8,
  fragLoadingMaxRetry: 8,
};

interface HlsApiStatus {
  live?: boolean;
  error?: string | null;
}

async function waitForLivePlaylist(
  signal: AbortSignal
): Promise<{ live: boolean; error: string | null }> {
  const started = Date.now();
  let lastError: string | null = null;

  while (!signal.aborted && Date.now() - started < 12_000) {
    try {
      const response = await fetch("/api/hls", { cache: "no-store", signal });
      const data = (await response.json()) as HlsApiStatus;
      if (data.live) return { live: true, error: null };
      if (data.error) lastError = data.error;
    } catch {
      lastError = "Falha ao consultar o stream";
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return { live: false, error: lastError };
}

export function useHlsStream(
  streamUrl: string,
  videoRef: RefObject<HTMLVideoElement | null>
): UseHlsStreamResult {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const connectRef = useRef<() => void>(() => undefined);

  const connect = useCallback(() => {
    if (typeof document !== "undefined" && document.pictureInPictureElement && hlsRef.current) {
      hlsRef.current.startLoad();
      void videoRef.current?.play().catch(() => undefined);
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const video = videoRef.current;
    if (!video) return;

    setStatus("connecting");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      const { live, error: streamError } = await waitForLivePlaylist(controller.signal);
      if (controller.signal.aborted) return;

      if (!live) {
        setStatus("offline");
        setError(streamError ?? "Câmera offline na rede local");
        window.setTimeout(() => {
          if (!controller.signal.aborted) connectRef.current();
        }, 4_000);
        return;
      }

      const cacheBustedUrl = `${streamUrl}?t=${Date.now()}`;

      if (Hls.isSupported()) {
        const hls = new Hls(HLS_CONFIG);
        hlsRef.current = hls;
        hls.loadSource(cacheBustedUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (controller.signal.aborted) return;
          void video.play().catch(() => undefined);
          setStatus("online");
          setError(null);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (controller.signal.aborted || !data.fatal) return;

          // Em PiP (tipicamente com a aba em segundo plano) nunca desanexar a
          // mídia: recoverMediaError()/reconexão chamam detachMedia() e isso
          // fecha a janela de Picture-in-Picture. Recupera sem destruir a mídia.
          if (document.pictureInPictureElement) {
            hls.startLoad();
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          setStatus("offline");
          setError("Stream perdido");
          window.setTimeout(() => {
            if (!controller.signal.aborted) connectRef.current();
          }, 3_000);
        });

        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = cacheBustedUrl;

        const onLoaded = () => {
          if (controller.signal.aborted) return;
          void video.play().catch(() => undefined);
          setStatus("online");
          setError(null);
        };
        const onError = () => {
          if (controller.signal.aborted) return;
          setStatus("offline");
          setError("Stream perdido");
        };

        video.addEventListener("loadedmetadata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
        controller.signal.addEventListener("abort", () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("error", onError);
        });
        return;
      }

      setStatus("offline");
      setError("HLS não suportado neste browser");
    })();
  }, [streamUrl, videoRef]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [connect]);

  return { status, error, connect };
}
