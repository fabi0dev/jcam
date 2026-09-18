"use client";

import Dialog from "@/components/Dialog";
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-sky-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const sensorIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M12 12a3 3 0 1 0 0-.01M4.9 4.9a10 10 0 0 0 0 14.2M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2"
    />
  </svg>
);

interface SettingsDialogProps {
  sensor: MotionSensor;
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ sensor, open, onClose }: SettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Sensor de movimento" icon={sensorIcon}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Ativar sensor</p>
          <p className="text-xs text-zinc-500">Alerta em mudanças bruscas na imagem</p>
        </div>
        <Toggle
          checked={sensor.enabled}
          onChange={sensor.toggleEnabled}
          label="Ativar sensor de movimento"
        />
      </div>

      <div
        className={`mt-6 space-y-6 transition-opacity ${
          sensor.enabled ? "opacity-100" : "pointer-events-none opacity-40"
        }`}
      >
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label htmlFor="motion-sens" className="font-medium text-zinc-200">
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
          <span className="font-medium text-zinc-200">Alerta sonoro</span>
          <Toggle checked={sensor.sound} onChange={sensor.toggleSound} label="Alerta sonoro" />
        </div>

        {!sensor.notificationsUnsupported && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-200">Notificação do navegador</span>
              <Toggle
                checked={sensor.notify}
                onChange={sensor.toggleNotify}
                label="Notificação do navegador"
              />
            </div>
            {sensor.notify && sensor.notificationsBlocked && (
              <p className="mt-1.5 text-[11px] text-amber-400">
                Permissão bloqueada — habilite as notificações deste site no navegador.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={sensor.triggerAlert}
        className="mt-7 w-full rounded-full bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-600"
      >
        Testar alerta
      </button>
    </Dialog>
  );
}
