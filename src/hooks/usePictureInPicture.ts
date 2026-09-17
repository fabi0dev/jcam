"use client";

import {
  useCallback,
  useEffect,
  useRef,
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

function startKeepAliveAudio(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.001;
    oscillator.frequency.value = 20;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    void context.resume();
    return context;
  } catch {
    return null;
  }
}

export function usePictureInPicture(
  videoRef: RefObject<HTMLVideoElement | null>,
  title: string,
  isUserMuted: boolean
): UsePictureInPictureResult {
  const isSupported = useSyncExternalStore(subscribeNoop, getPipSupport, () => false);
  const [isActive, setIsActive] = useState(false);
  const wantsPipRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const userMutedRef = useRef(isUserMuted);

  useEffect(() => {
    userMutedRef.current = isUserMuted;
  }, [isUserMuted]);

  const applyUserAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = userMutedRef.current ? 0 : 1;
    video.muted = false;
  }, [videoRef]);

  const restorePageAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = userMutedRef.current ? 0 : 1;
    video.muted = userMutedRef.current;
  }, [videoRef]);

  const keepPlaying = useCallback(() => {
    const video = videoRef.current;
    if (!video || !wantsPipRef.current) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    }
  }, [videoRef]);

  const enterPip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    applyUserAudio();
    await video.play();

    if (!document.pictureInPictureElement) {
      await video.requestPictureInPicture();
    }
  }, [applyUserAudio, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsActive(true);
    const onLeave = () => {
      setIsActive(false);
      if (wantsPipRef.current && document.visibilityState === "hidden") {
        keepPlaying();
        void enterPip();
        return;
      }
      wantsPipRef.current = false;
      restorePageAudio();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!wantsPipRef.current) return;
        keepPlaying();
        if (!document.pictureInPictureElement) {
          void enterPip();
        }
        return;
      }

      if (!document.pictureInPictureElement) {
        wantsPipRef.current = false;
        restorePageAudio();
      }
    };

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    video.addEventListener("pause", keepPlaying);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("freeze", keepPlaying);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
      video.removeEventListener("pause", keepPlaying);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("freeze", keepPlaying);
    };
  }, [enterPip, keepPlaying, restorePageAudio, videoRef]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "JCam",
    });

    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", () => {
        if (!wantsPipRef.current) return;
        void enterPip();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        keepPlaying();
      });
      navigator.mediaSession.setActionHandler("play", () => {
        keepPlaying();
      });
    } catch {
      // Media Session handlers are optional.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("enterpictureinpicture", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("play", null);
      } catch {
        // ignore
      }
    };
  }, [enterPip, keepPlaying, title]);

  const toggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        wantsPipRef.current = false;
        restorePageAudio();
        await document.exitPictureInPicture();
        if (audioRef.current) {
          void audioRef.current.close().catch(() => undefined);
          audioRef.current = null;
        }
        return;
      }

      wantsPipRef.current = true;
      if (!audioRef.current) {
        audioRef.current = startKeepAliveAudio();
      }
      navigator.mediaSession.playbackState = "playing";
      await enterPip();
    } catch (error) {
      wantsPipRef.current = false;
      restorePageAudio();
      console.error("PiP error:", error);
    }
  }, [enterPip, restorePageAudio, videoRef]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        void audioRef.current.close().catch(() => undefined);
        audioRef.current = null;
      }
    };
  }, []);

  return { isSupported, isActive, toggle };
}
