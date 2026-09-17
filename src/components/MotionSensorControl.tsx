"use client";

import { useState } from "react";
import type { MotionSensor } from "@/hooks/useMotionSensor";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-sky-500" : "bg-zinc-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          checked ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function MotionSensorControl({ sensor }: { sensor: MotionSensor }) {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              sensor.enabled ? "bg-sky-500/15 text-sky-400" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 12a3 3 0 1 0 0-.01M4.9 4.9a10 10 0 0 0 0 14.2M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2"
              />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-white">Sensor de movimento</p>
            <p className="text-xs text-zinc-500">
              {sensor.enabled
                ? "Ativo — alerta em mudanças bruscas na imagem"
                : "Desativado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Toggle
            checked={sensor.enabled}
            onChange={sensor.toggleEnabled}
            label="Ativar sensor de movimento"
          />
          <button
            type="button"
            title="Configurar sensor"
            aria-label="Configurar sensor de movimento"
            aria-expanded={configOpen}
            onClick={() => setConfigOpen((open) => !open)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              configOpen ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </div>

      {configOpen && (
        <div className="border-t border-zinc-800 px-4 py-4">
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <label htmlFor="motion-sens" className="text-zinc-300">
                Sensibilidade
              </label>
              <span className="tabular-nums text-zinc-500">{sensor.sensitivity}</span>
            </div>
            <input
              id="motion-sens"
              type="range"
              min={1}
              max={100}
              value={sensor.sensitivity}
              onChange={(event) => sensor.setSensitivity(Number(event.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
              <span>Baixa</span>
              <span>Alta</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">Alerta sonoro</span>
            <Toggle checked={sensor.sound} onChange={sensor.toggleSound} label="Alerta sonoro" />
          </div>

          {!sensor.notificationsUnsupported && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">Notificação do navegador</span>
                <Toggle
                  checked={sensor.notify}
                  onChange={sensor.toggleNotify}
                  label="Notificação do navegador"
                />
              </div>
              {sensor.notify && sensor.notificationsBlocked && (
                <p className="mt-1 text-[11px] text-amber-400">
                  Permissão bloqueada — habilite as notificações deste site no navegador.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={sensor.triggerAlert}
            className="mt-4 w-full rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Testar alerta
          </button>
        </div>
      )}
    </div>
  );
}
