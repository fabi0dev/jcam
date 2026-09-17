import { NextRequest } from "next/server";
import { spawn, ChildProcess } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// FFmpeg persistente — um processo servindo todos os clientes
let ffmpeg: ChildProcess | null = null;
let outputBuffer = Buffer.alloc(0);
const subscribers = new Set<(frame: Buffer) => void>();
let starting = false;

function startFFmpeg() {
  if (ffmpeg || starting) return;
  starting = true;

  const rtspUrl = process.env.CAMERA_RTSP_URL;
  if (!rtspUrl) {
    starting = false;
    return;
  }

  ffmpeg = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-i", rtspUrl,
    "-f", "mjpeg",
    "-q:v", "5",
    "-r", "10",
    "-s", "1280x720",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const SOI = Buffer.from([0xff, 0xd8]);
  const EOI = Buffer.from([0xff, 0xd9]);

  ffmpeg.stdout!.on("data", (chunk: Buffer) => {
    outputBuffer = Buffer.concat([outputBuffer, chunk]);

    while (true) {
      const start = outputBuffer.indexOf(SOI);
      if (start === -1) {
        outputBuffer = Buffer.alloc(0);
        break;
      }

      const end = outputBuffer.indexOf(EOI, start + 2);
      if (end === -1) break; // frame incompleto

      const frame = outputBuffer.subarray(start, end + 2).toString("base64");
      outputBuffer = outputBuffer.subarray(end + 2);

      // distribui pra todos os subscribers
      for (const cb of subscribers) {
        try { cb(Buffer.from(frame, "base64")); } catch {}
      }
    }
  });

  ffmpeg.on("close", () => {
    ffmpeg = null;
    starting = false;
    outputBuffer = Buffer.alloc(0);
    // reconecta após 2s
    setTimeout(startFFmpeg, 2000);
  });

  ffmpeg.on("error", () => {
    ffmpeg = null;
    starting = false;
    setTimeout(startFFmpeg, 2000);
  });
}

export async function GET(_req: NextRequest) {
  startFFmpeg();

  const boundary = "jcamframe";
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      const encoder = new TextEncoder();

      const onFrame = (jpegBase64: Buffer) => {
        if (!controller) return;
        const data = `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBase64.length}\r\n\r\n`;
        try {
          ctrl.enqueue(encoder.encode(data));
          ctrl.enqueue(jpegBase64);
          ctrl.enqueue(encoder.encode("\r\n"));
        } catch {}
      };

      subscribers.add(onFrame);

      // envia frame placeholder enquanto não chega nada
      const placeholder = encoder.encode(
        `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: 0\r\n\r\n`
      );
      ctrl.enqueue(placeholder);
    },
    cancel() {
      controller = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
