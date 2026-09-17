import { createHash } from "node:crypto";
import http from "node:http";

const IP = process.env.CAMERA_IP || "192.168.1.53";
const USER = process.env.CAMERA_USER || "mmrr";
const PASS = process.env.CAMERA_PASS || "ry6uxr";
const PORTS = Array.from(
  new Set([Number(process.env.CAMERA_ONVIF_PORT || "8899"), 80])
);

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
}

interface HttpResult {
  status: number;
  wwwAuth: string;
  body: string;
}

let agent = createAgent();
let activePort = PORTS[0];
let ready = false;

function createAgent(): http.Agent {
  return new http.Agent({
    keepAlive: true,
    maxSockets: 1,
    keepAliveMsecs: 10_000,
  });
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function parseChallenge(header: string): DigestChallenge {
  const read = (key: string): string | undefined => {
    const quoted = header.match(new RegExp(`${key}="([^"]+)"`, "i"));
    if (quoted) return quoted[1];
    const raw = header.match(new RegExp(`${key}=([^,\\s]+)`, "i"));
    return raw?.[1];
  };

  return {
    realm: read("realm") ?? "",
    nonce: read("nonce") ?? "",
    qop: read("qop")?.split(",")[0],
    opaque: read("opaque"),
  };
}

function buildDigest(challenge: DigestChallenge, method: string, uri: string): string {
  const ha1 = md5(`${USER}:${challenge.realm}:${PASS}`);
  const ha2 = md5(`${method}:${uri}`);
  const nc = "00000001";
  const cnonce = md5(`${Date.now()}`);
  const response = challenge.qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);

  const parts = [
    `Digest username="${USER}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];

  if (challenge.qop) {
    parts.push(`qop=${challenge.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  if (challenge.opaque) {
    parts.push(`opaque="${challenge.opaque}"`);
  }

  return parts.join(", ");
}

function httpPost(port: number, path: string, soap: string, authorization?: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: IP,
        port,
        path,
        method: "POST",
        family: 4,
        agent,
        timeout: 4000,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(soap),
          Connection: "keep-alive",
          ...(authorization ? { Authorization: authorization } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            wwwAuth: String(res.headers["www-authenticate"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.write(soap);
    req.end();
  });
}

export function isOnvifReady(): boolean {
  return ready;
}

export function markOnvifReady(): void {
  ready = true;
}

export function markOnvifDown(): void {
  ready = false;
}

export function resetOnvifAgent(): void {
  ready = false;
  agent.destroy();
  agent = createAgent();
}

export function setOnvifPort(port: number): void {
  activePort = port;
}

export function getOnvifPorts(): number[] {
  return PORTS;
}

export async function onvifPost(path: string, soap: string): Promise<string> {
  try {
    const result = await onvifPostOnPort(activePort, path, soap);
    ready = true;
    return result;
  } catch (error) {
    ready = false;
    throw error;
  }
}

export async function onvifPostOnPort(port: number, path: string, soap: string): Promise<string> {
  let result = await httpPost(port, path, soap);

  if (result.status === 401 && result.wwwAuth.toLowerCase().includes("digest")) {
    result = await httpPost(
      port,
      path,
      soap,
      buildDigest(parseChallenge(result.wwwAuth), "POST", path)
    );
  } else if (result.status === 401) {
    result = await httpPost(
      port,
      path,
      soap,
      `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`
    );
  }

  if (result.status >= 400) {
    ready = false;
    throw new Error(`HTTP ${result.status}`);
  }

  return result.body;
}
