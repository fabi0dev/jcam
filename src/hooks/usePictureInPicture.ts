"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

interface UsePictureInPictureResult {
  isSupported: boolean;
  isActive: boolean;
  toggle: () => Promise<void>;
}

function subscribeNoop(): () => void {
  return () => undefined;
}

function getPipSupport(): boolean {
  return (
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    Boolean(document.pictureInPictureEnabled)
  );
}

export function usePictureInPicture(
  videoRef: RefObject<HTMLVideoElement | null>
): UsePictureInPictureResult {
  const isSupported = useSyncExternalStore(subscribeNoop, getPipSupport, () => false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsActive(true);
    const onLeave = () => setIsActive(false);

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [videoRef]);

  const toggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      // O vídeo precisa estar tocando ao entrar no PiP (com a stream de áudio
      // real, o Chrome mantém a janela aberta mesmo com a aba em segundo plano).
      await video.play().catch(() => undefined);
      await video.requestPictureInPicture();
    } catch (error) {
      console.error("PiP error:", error);
    }
  }, [videoRef]);

  return { isSupported, isActive, toggle };
}
