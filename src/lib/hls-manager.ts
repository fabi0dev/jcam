import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HLS_DIR = join(process.cwd(), "public", "hls");
const SEGMENT_LIFETIME_MS = 10_000;
const MIN_RESTART_MS = 5_000;
const MAX_RESTART_MS = 30_000;

export interface HlsRuntimeStatus {
  live: boolean;
  connecting: boolean;
  lastError: string | null;
}

interface HlsRuntime {
  ffmpeg: ChildProcess | null;
  starting: boolean;
  restartTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setInterval> | null;
  restartDelayMs: number;
  cooldownUntil: number;
  lastError: string | null;
}

const runtime = getRuntime();

function getRuntime(): HlsRuntime {
  const globalRef = globalThis as typeof globalThis & { __jcamHls?: HlsRuntime };
  if (!globalRef.__jcamHls) {
    globalRef.__jcamHls = {
      ffmpeg: null,
      starting: false,
      restartTimer: null,
      cleanupTimer: null,
      restartDelayMs: MIN_RESTART_MS,
      cooldownUntil: 0,
      lastError: null,
    };
  }
  return globalRef.__jcamHls;
}

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
  };
}

async function ensureHlsDir(): Promise<void> {
  await mkdir(HLS_DIR, { recursive: true });
}

async function clearHlsFiles(): Promise<void> {
  await ensureHlsDir();
  try {
    const files = await readdir(HLS_DIR);
    await Promise.all(files.map((file) => unlink(join(HLS_DIR, file)).catch(() => undefined)));
  } catch {
    // diretório ainda vazio
  }

  await writeFile(
    join(HLS_DIR, "stream.m3u8"),
    "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n"
  );
}

function clearRestart(): void {
  if (!runtime.restartTimer) return;
  clearTimeout(runtime.restartTimer);
  runtime.restartTimer = null;
}

function scheduleRestart(): void {
  runtime.cooldownUntil = Date.now() + runtime.restartDelayMs;
  if (runtime.restartTimer) return;
  runtime.restartTimer = setTimeout(() => {
    runtime.restartTimer = null;
    startFFmpeg();
  }, runtime.restartDelayMs);
  runtime.restartDelayMs = Math.min(runtime.restartDelayMs * 2, MAX_RESTART_MS);
}

function stopFFmpeg(): void {
  const child = runtime.ffmpeg;
  if (!child) return;
  child.removeAllListeners();
  child.kill("SIGTERM");
  runtime.ffmpeg = null;
}

function attachFFmpeg(child: ChildProcess): void {
  child.stderr?.on("data", (chunk: Buffer) => {
    const message = chunk.toString("utf8").trim();
    if (!message) return;
    runtime.lastError = message.split("\n").at(-1) ?? message;
    console.error("[ffmpeg]", message);
  });

  child.on("close", (code) => {
    if (runtime.ffmpeg === child) {
      runtime.ffmpeg = null;
    }
    runtime.starting = false;
    if (!runtime.lastError) {
      runtime.lastError = `ffmpeg encerrou (código ${code ?? "null"})`;
    }
    if (runtime.lastError.includes("No route")) {
      runtime.restartDelayMs = Math.max(runtime.restartDelayMs, 15_000);
    }
    scheduleRestart();
  });

  child.on("error", (error) => {
    runtime.lastError = error.message;
    console.error("[ffmpeg] spawn error:", error);
    if (runtime.ffmpeg === child) {
      runtime.ffmpeg = null;
    }
    runtime.starting = false;
    scheduleRestart();
  });
}

export async function hasLivePlaylist(): Promise<boolean> {
  try {
    const content = await readFile(join(HLS_DIR, "stream.m3u8"), "utf8");
    return content.includes(".ts") && !content.includes("#EXT-X-ENDLIST");
  } catch {
    return false;
  }
}

export async function getHlsStatus(): Promise<HlsRuntimeStatus> {
  return {
    live: await hasLivePlaylist(),
    connecting: runtime.starting || runtime.ffmpeg !== null,
    lastError: runtime.lastError,
  };
}

export function startFFmpeg(): void {
  if (runtime.ffmpeg || runtime.starting) return;
  if (Date.now() < runtime.cooldownUntil) return;
  runtime.starting = true;
  clearRestart();

  const rtspUrl = process.env.CAMERA_RTSP_URL;
  if (!rtspUrl) {
    runtime.lastError = "CAMERA_RTSP_URL não configurada";
    runtime.starting = false;
    return;
  }

  void (async () => {
    try {
      await clearHlsFiles();
    } catch {
      // segue mesmo se a limpeza falhar
    }

    if (runtime.ffmpeg) {
      runtime.starting = false;
      return;
    }

    stopFFmpeg();

    runtime.ffmpeg = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        // Baixa latência na entrada: não acumular buffer do demuxer.
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-rtsp_transport",
        "tcp",
        "-i",
        rtspUrl,
        // Áudio real da câmera (pcm_alaw) transcodificado para AAC. Além de
        // permitir ouvir o ambiente, é essencial para o Picture-in-Picture: o
        // Chrome suspende mídia "sem som" na aba oculta e fecha o PiP — uma
        // faixa silenciosa não basta, precisa ser áudio audível de verdade.
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        // Keyframe a cada 0,5s (independente do fps da câmera). Sem isto o GOP
        // longo obriga segmentos HLS de vários segundos e a latência dispara.
        "-force_key_frames",
        "expr:gte(t,n_forced*0.5)",
        "-sc_threshold",
        "0",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-ar",
        "44100",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-f",
        "hls",
        "-hls_time",
        "0.5",
        "-hls_list_size",
        "6",
        "-hls_flags",
        "delete_segments+append_list+omit_endlist+independent_segments",
        "-hls_segment_filename",
        join(HLS_DIR, "seg_%03d.ts"),
        join(HLS_DIR, "stream.m3u8"),
      ],
      {
        stdio: ["ignore", "ignore", "pipe"],
        env: ffmpegEnv(),
      }
    );

    attachFFmpeg(runtime.ffmpeg);
    runtime.starting = false;
    runtime.restartDelayMs = MIN_RESTART_MS;
  })();
}

export function startCleanup(): void {
  if (runtime.cleanupTimer) return;

  runtime.cleanupTimer = setInterval(() => {
    void (async () => {
      try {
        const files = await readdir(HLS_DIR);
        const now = Date.now();
        for (const file of files) {
          if (!file.startsWith("seg_")) continue;
          const path = join(HLS_DIR, file);
          const info = await stat(path);
          if (now - info.mtimeMs > SEGMENT_LIFETIME_MS) {
            await unlink(path).catch(() => undefined);
          }
        }
      } catch {
        // ignora
      }
    })();
  }, 5_000);
}
