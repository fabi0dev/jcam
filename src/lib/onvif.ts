import {
  getOnvifPorts,
  isOnvifReady,
  markOnvifDown,
  markOnvifReady,
  onvifPost,
  onvifPostOnPort,
  resetOnvifAgent,
  setOnvifPort,
} from "@/lib/onvif-client";

const PROFILE_TOKEN = "000";
const USER = process.env.CAMERA_USER || "mmrr";
const PASS = process.env.CAMERA_PASS || "ry6uxr";

function soapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
  xmlns:timg="http://www.onvif.org/ver20/imaging/wsdl"
  xmlns:tt="http://www.onvif.org/ver10/schema">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${USER}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${PASS}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

function clampVelocity(value: number): number {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

function assertOnvifSuccess(xml: string): void {
  if (!xml.includes("Fault")) return;
  const reason = xml.match(/<.*?Reason>[\s\S]*?<.*?Text.*?>([^<]+)/)?.[1] ?? xml.slice(0, 280);
  throw new Error(reason);
}

export async function onvifCall(service: string, body: string): Promise<string> {
  const xml = await onvifPost(`/onvif/${service}`, soapEnvelope(body));
  assertOnvifSuccess(xml);
  return xml;
}

export async function pingOnvif(): Promise<void> {
  await onvifCall(
    "ptz_service",
    `<tptz:GetStatus>
      <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
    </tptz:GetStatus>`
  );
}

export async function connectOnvif(): Promise<void> {
  const pingBody = soapEnvelope(
    `<tptz:GetStatus>
      <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
    </tptz:GetStatus>`
  );

  let lastError: unknown;
  for (const port of getOnvifPorts()) {
    try {
      setOnvifPort(port);
      await onvifPostOnPort(port, "/onvif/ptz_service", pingBody);
      setOnvifPort(port);
      markOnvifReady();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  markOnvifDown();
  throw lastError instanceof Error ? lastError : new Error("ONVIF indisponível");
}

export { isOnvifReady, markOnvifDown, resetOnvifAgent };

export async function ptzMove(pan: number, tilt: number) {
  if (pan === 0 && tilt === 0) return;

  return onvifCall(
    "ptz_service",
    `<tptz:ContinuousMove>
      <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
      <tptz:Velocity>
        <tt:PanTilt x="${clampVelocity(pan)}" y="${clampVelocity(tilt)}"/>
      </tptz:Velocity>
      <tptz:Timeout>PT5S</tptz:Timeout>
    </tptz:ContinuousMove>`
  );
}

export async function ptzStop() {
  try {
    await onvifCall(
      "ptz_service",
      `<tptz:Stop>
        <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
        <tptz:PanTilt>true</tptz:PanTilt>
      </tptz:Stop>`
    );
  } catch {
    markOnvifDown();
  }
}

export async function ptzGoPreset(presetToken: string) {
  return onvifCall(
    "ptz_service",
    `<tptz:GotoPreset>
      <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
      <tptz:PresetToken>${presetToken}</tptz:PresetToken>
    </tptz:GotoPreset>`
  );
}

export async function ptzGetPresets() {
  const xml = await onvifCall(
    "ptz_service",
    `<tptz:GetPresets>
      <tptz:ProfileToken>${PROFILE_TOKEN}</tptz:ProfileToken>
    </tptz:GetPresets>`
  );
  const presets: { token: string; name: string }[] = [];
  const regex = /token="([^"]*)".*?<tt:Name>([^<]*)<\/tt:Name>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    presets.push({ token: match[1], name: match[2] });
  }
  return presets;
}

export async function imagingGetSettings() {
  const xml = await onvifCall(
    "image_service",
    `<timg:GetImagingSettings>
      <timg:VideoSourceToken>V_SRC_000</timg:VideoSourceToken>
    </timg:GetImagingSettings>`
  );

  const extract = (tag: string): number | null => {
    const match = xml.match(new RegExp(`<tt:${tag}>([^<]*)<\\/tt:${tag}>`));
    return match ? parseFloat(match[1]) : null;
  };

  return {
    brightness: extract("Brightness"),
    contrast: extract("Contrast"),
    saturation: extract("ColorSaturation"),
    sharpness: extract("Sharpness"),
  };
}

export async function imagingSetSettings(settings: {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
}) {
  let imgSettings = "";
  if (settings.brightness !== undefined)
    imgSettings += `<tt:Brightness>${settings.brightness}</tt:Brightness>`;
  if (settings.contrast !== undefined)
    imgSettings += `<tt:Contrast>${settings.contrast}</tt:Contrast>`;
  if (settings.saturation !== undefined)
    imgSettings += `<tt:ColorSaturation>${settings.saturation}</tt:ColorSaturation>`;
  if (settings.sharpness !== undefined)
    imgSettings += `<tt:Sharpness>${settings.sharpness}</tt:Sharpness>`;

  return onvifCall(
    "image_service",
    `<timg:SetImagingSettings>
      <timg:VideoSourceToken>V_SRC_000</timg:VideoSourceToken>
      <timg:ImagingSettings>${imgSettings}</timg:ImagingSettings>
    </timg:SetImagingSettings>`
  );
}
