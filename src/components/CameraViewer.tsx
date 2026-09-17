"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useHlsStream, type StreamStatus } from "@/hooks/useHlsStream";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { useCameraAudio } from "@/hooks/useCameraAudio";
import PTZControls from "@/components/PTZControls";

interface CameraViewerProps {
  name: string;
  streamUrl: string;
  ptzApiUrl: string;
}

const STATUS_LABEL: Record<StreamStatus, string> = {
  online: "Ao vivo",
  connecting: "Conectando",
  offline: "Offline",
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
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export default function CameraViewer({ name, streamUrl, ptzApiUrl }: CameraViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const { status, error, connect } = useHlsStream(streamUrl, videoRef);
  const { isSupported: pipSupported, isActive: isPip, toggle: togglePip } =
    usePictureInPicture(videoRef, name, isMuted);

  useCameraAudio({ videoRef, isPip, isMuted });

  const toggleMute = useCallback(() => {
    setIsMuted((current) => !current);
  }, []);

  const chromeClassName =
    "opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto";

  return (
    <section className="w-full">
      <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-black aspect-video shadow-2xl shadow-black/40">
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
              <span className="text-sm text-zinc-400">Conectando...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-red-400">{error}</span>
              <button
                type="button"
                onClick={connect}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {isPip && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/55">
            <span className="rounded-full bg-black/50 px-3 py-1 text-sm text-zinc-200">
              Picture-in-Picture ativo
            </span>
          </div>
        )}

        <div className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 ${chromeClassName}`}>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === "online"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : status === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white drop-shadow">{name}</p>
              <p className="text-[11px] uppercase tracking-wide text-zinc-300">
                {STATUS_LABEL[status]}
              </p>
            </div>
          </div>
        </div>

        <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-12 ${chromeClassName}`}>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <ViewerButton
                label={isMuted ? "Ativar som" : "Mutar"}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.5 9.5 10 6v12l-4.5-3.5H3v-5h2.5zM14.5 8.5a5 5 0 010 7M17 6.5a8 8 0 010 11" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5v-11z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 13h5v4h-5v-4z" />
                  </svg>
                </ViewerButton>
              )}

              <ViewerButton label="Reconectar" onClick={connect}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0012.9 2M19 9A7 7 0 006.1 7" />
                </svg>
              </ViewerButton>
            </div>

            <div className="pointer-events-auto">
              <PTZControls apiUrl={ptzApiUrl} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
