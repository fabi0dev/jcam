import CameraViewer from "@/components/CameraViewer";

export default function Home() {
  const cameraName = process.env.CAMERA_NAME || "Câmera";

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Monitoramento
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            JCam
          </h1>
        </header>

        <CameraViewer
          name={cameraName}
          streamUrl="/hls/stream.m3u8"
          ptzApiUrl="/api/ptz"
        />
      </div>
    </main>
  );
}
