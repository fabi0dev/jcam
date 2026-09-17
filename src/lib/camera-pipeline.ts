import { connectOnvif, isOnvifReady, resetOnvifAgent } from "@/lib/onvif";

let connecting: Promise<void> | null = null;

async function openControlChannel(): Promise<void> {
  if (isOnvifReady()) return;

  try {
    await connectOnvif();
  } catch (error) {
    resetOnvifAgent();
    throw error instanceof Error ? error : new Error("Câmera recusou o PTZ");
  }
}

export async function ensureCameraControl(): Promise<void> {
  if (connecting) {
    await connecting;
    return;
  }

  connecting = openControlChannel().finally(() => {
    connecting = null;
  });

  await connecting;
}
