"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useHlsStream, type StreamStatus } from "@/hooks/useHlsStream";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { useCameraAudio } from "@/hooks/useCameraAudio";
import PTZControls from "@/components/PTZControls";

interface CameraViewerProps {
  name: string;
  streamUrl: string;
  ptzApiUrl: string;
}

const STATUS_META: Record<
  StreamStatus,
  { label: string; dot: string; text: string }
> = {
  online: {
    label: "Ao vivo",
    dot: "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]",
    text: "text-emerald-300",
  },
  connecting: {
    label: "Conectando",
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-300",
  },
  offline: {
    label: "Offline",
    dot: "bg-red-500",
    text: "text-red-300",
  },
};

interface ViewerButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ViewerButton({ label, active = false, disabled = false, onClick, children }: ViewerButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-sky-500 text-white"
          : "text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

export default function CameraViewer({ name, streamUrl, ptzApiUrl }: CameraViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { status, error, connect } = useHlsStream(streamUrl, videoRef);
  const { isSupported: pipSupported, isActive: isPip, toggle: togglePip } =
    usePictureInPicture(videoRef);

  useCameraAudio({ videoRef, isPip, isMuted });

  const toggleMute = useCallback(() => {
    setIsMuted((current) => !current);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void frame.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const statusMeta = STATUS_META[status];

  return (
    <section className="w-full">
      <div
        ref={frameRef}
        className="group relative aspect-video w-full overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl shadow-black/50"
      >
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted={isMuted && !isPip}
          autoPlay
          onLoadedData={() => {
            void videoRef.current?.play().catch(() => undefined);
          }}
        />

        {status === "connecting" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
              <span className="text-sm font-medium text-zinc-300">Conectando…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950">
            <div className="flex max-w-xs flex-col items-center gap-4 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950 text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              </span>
              <p className="text-sm text-zinc-300">{error}</p>
              <button
                type="button"
                onClick={connect}
                className="rounded-full bg-zinc-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {isPip && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 13h5v4h-5v-4z" />
              </svg>
            </span>
            <span className="text-sm font-medium text-zinc-200">Reproduzindo em Picture-in-Picture</span>
          </div>
        )}

        {/* Top bar — status */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-zinc-900/70 px-3 py-1.5 backdrop-blur-md">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            <span className="text-sm font-medium text-white">{name}</span>
            <span className="text-white/20">·</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${statusMeta.text}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Bottom bar — controls + PTZ (aparece ao passar o mouse no vídeo) */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 sm:p-4">
          <div className="flex items-center gap-1 rounded-full bg-zinc-900/70 p-1 backdrop-blur-md">
            <ViewerButton
              label={isMuted ? "Ativar som" : "Silenciar"}
              active={!isMuted}
              disabled={status !== "online"}
              onClick={toggleMute}
            >
              {isMuted ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.5 9.5 10 6v12l-4.5-3.5H3v-5h2.5zM16 9.5l4 5M20 9.5l-4 5" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.5 9.5 10 6v12l-4.5-3.5H3v-5h2.5zM14.5 8.5a5 5 0 0 1 0 7M17 6.5a8 8 0 0 1 0 11" />
                </svg>
              )}
            </ViewerButton>

            {pipSupported && (
              <ViewerButton
                label={isPip ? "Sair do PiP" : "Picture-in-Picture"}
                active={isPip}
                disabled={status !== "online"}
                onClick={() => void togglePip()}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 13h5v4h-5v-4z" />
                </svg>
              </ViewerButton>
            )}

            <ViewerButton
              label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              active={isFullscreen}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              )}
            </ViewerButton>

            <ViewerButton label="Reconectar" onClick={connect}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 12.9 2M19 9A7 7 0 0 0 6.1 7" />
              </svg>
            </ViewerButton>
          </div>

          <PTZControls apiUrl={ptzApiUrl} />
        </div>
      </div>
    </section>
  );
}
