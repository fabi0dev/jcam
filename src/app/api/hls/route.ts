import { NextResponse } from "next/server";
import { getHlsStatus, startCleanup, startFFmpeg } from "@/lib/hls-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  startFFmpeg();
  startCleanup();

  const status = await getHlsStatus();
  return NextResponse.json({
    ok: true,
    live: status.live,
    connecting: status.connecting,
    error: status.lastError,
    playlist: "/hls/stream.m3u8",
  });
}
