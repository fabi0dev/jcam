"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useMotionDetection } from "@/hooks/useMotionDetection";

const STORE_KEY = "jcam.motion";
const ALERT_DURATION_MS = 4000;

interface StoredConfig {
  enabled: boolean;
  sensitivity: number;
  sound: boolean;
}

const DEFAULTS: StoredConfig = { enabled: false, sensitivity: 50, sound: true };

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StoredConfig>) };
  } catch {
    return DEFAULTS;
  }
}

export interface MotionSensor {
  enabled: boolean;
  sensitivity: number;
  sound: boolean;
  alerting: boolean;
  toggleEnabled: () => void;
  setSensitivity: (value: number) => void;
  toggleSound: () => void;
  triggerAlert: () => void;
}

export function useMotionSensor(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean
): MotionSensor {
  const [enabled, setEnabled] = useState(DEFAULTS.enabled);
  const [sensitivity, setSensitivity] = useState(DEFAULTS.sensitivity);
  const [sound, setSound] = useState(DEFAULTS.sound);
  const [alerting, setAlerting] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const soundRef = useRef(sound);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Carrega preferências (client-side, evita mismatch de hidratação).
  useEffect(() => {
    const cfg = loadConfig();
    setEnabled(cfg.enabled);
    setSensitivity(cfg.sensitivity);
    setSound(cfg.sound);
    setHydrated(true);
  }, []);

  // Só persiste depois de carregar, para não sobrescrever o valor salvo.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ enabled, sensitivity, sound }));
    } catch {
      // ignore
    }
  }, [hydrated, enabled, sensitivity, sound]);

  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) {
      void audioCtxRef.current.resume().catch(() => undefined);
      return;
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) audioCtxRef.current = new Ctor();
    } catch {
      audioCtxRef.current = null;
    }
  }, []);

  const beep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 900;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  }, []);

  const triggerAlert = useCallback(() => {
    setAlerting(true);
    if (soundRef.current) beep();
    if (alertTimer.current) clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlerting(false), ALERT_DURATION_MS);
  }, [beep]);

  useEffect(() => {
    return () => {
      if (alertTimer.current) clearTimeout(alertTimer.current);
    };
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (next) ensureAudio();
      else setAlerting(false);
      return next;
    });
  }, [ensureAudio]);

  const toggleSound = useCallback(() => {
    ensureAudio();
    setSound((current) => !current);
  }, [ensureAudio]);

  useMotionDetection({
    videoRef,
    enabled: enabled && active,
    sensitivity,
    onMotion: triggerAlert,
  });

  return {
    enabled,
    sensitivity,
    sound,
    alerting,
    toggleEnabled,
    setSensitivity,
    toggleSound,
    triggerAlert,
  };
}
