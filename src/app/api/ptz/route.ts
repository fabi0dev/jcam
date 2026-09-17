import { NextRequest, NextResponse } from "next/server";
import { ensureCameraControl } from "@/lib/camera-pipeline";
import { ptzMove, ptzStop, ptzGoPreset, ptzGetPresets } from "@/lib/onvif";

export const runtime = "nodejs";

// GET: listar presets
export async function GET() {
  try {
    const presets = await ptzGetPresets();
    return NextResponse.json({ presets });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: mover / parar / ir pra preset
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, pan, tilt, preset } = body;

    switch (action) {
      case "move":
        await ensureCameraControl();
        await ptzMove(pan ?? 0, tilt ?? 0);
        return NextResponse.json({ ok: true });

      case "stop":
        await ptzStop();
        return NextResponse.json({ ok: true });

      case "preset":
        if (!preset) {
          return NextResponse.json(
            { error: "preset token obrigatório" },
            { status: 400 }
          );
        }
        await ptzGoPreset(preset);
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json(
          { error: `Ação desconhecida: ${action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
