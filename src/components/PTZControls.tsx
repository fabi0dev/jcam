"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface PTZControlsProps {
  apiUrl: string;
}

interface PtzButtonProps {
  label: string;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onClick?: () => void;
  children: ReactNode;
}

function PtzButton({ label, onPointerDown, onPointerUp, onClick, children }: PtzButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerDown?.();
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25 active:bg-white/35"
    >
      {children}
    </button>
  );
}

export default function PTZControls({ apiUrl }: PTZControlsProps) {
  const moveInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMove = useCallback(() => {
    if (!moveInterval.current) return;
    clearInterval(moveInterval.current);
    moveInterval.current = null;
  }, []);

  const clearStopTimer = useCallback(() => {
    if (!stopTimer.current) return;
    clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  const move = useCallback(
    (pan: number, tilt: number) => {
      void fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", pan, tilt }),
      }).catch(() => undefined);
    },
    [apiUrl]
  );

  const stop = useCallback(() => {
    clearMove();
    clearStopTimer();
    stopTimer.current = setTimeout(() => {
      void fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      }).catch(() => undefined);
    }, 400);
  }, [apiUrl, clearMove, clearStopTimer]);

  const startMove = useCallback(
    (pan: number, tilt: number) => {
      clearStopTimer();
      clearMove();
      move(pan, tilt);
      moveInterval.current = setInterval(() => {
        move(pan, tilt);
      }, 250);
    },
    [clearMove, clearStopTimer, move]
  );

  useEffect(() => {
    return () => {
      clearMove();
      clearStopTimer();
    };
  }, [clearMove, clearStopTimer]);

  return (
    <div className="pointer-events-auto select-none" aria-label="Controle PTZ">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/35 p-1.5 backdrop-blur-md">
        <span />
        <PtzButton label="Cima" onPointerDown={() => startMove(0, 0.5)} onPointerUp={stop}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </PtzButton>
        <span />

        <PtzButton label="Esquerda" onPointerDown={() => startMove(-0.5, 0)} onPointerUp={stop}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </PtzButton>
        <PtzButton label="Parar" onClick={stop}>
          <span className="h-2.5 w-2.5 rounded-full bg-white/80" />
        </PtzButton>
        <PtzButton label="Direita" onPointerDown={() => startMove(0.5, 0)} onPointerUp={stop}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </PtzButton>

        <span />
        <PtzButton label="Baixo" onPointerDown={() => startMove(0, -0.5)} onPointerUp={stop}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </PtzButton>
        <span />
      </div>
    </div>
  );
}
