import { NextRequest, NextResponse } from "next/server";
import { imagingGetSettings, imagingSetSettings } from "@/lib/onvif";

export const runtime = "nodejs";

// GET: obter configurações atuais
export async function GET() {
  try {
    const settings = await imagingGetSettings();
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: atualizar configurações
export async function POST(req: NextRequest) {
  try {
    const settings = await req.json();
    await imagingSetSettings(settings);
    const updated = await imagingGetSettings();
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
