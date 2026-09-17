import CameraViewer from "@/components/CameraViewer";

export default function Home() {
  const cameraName = process.env.CAMERA_NAME || "Câmera";

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      {/* Brilho decorativo de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(56,189,248,0.12),transparent_70%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        <header className="mb-6 flex items-center gap-3 sm:mb-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-sky-500/25">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8.5A1.5 1.5 0 0 1 5.5 7H14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14 17H5.5A1.5 1.5 0 0 1 4 15.5v-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15.5 10.5 4-2.5v8l-4-2.5" />
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">JCam</h1>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Monitoramento ao vivo
            </p>
          </div>
        </header>

        <div className="flex flex-1 items-center">
          <CameraViewer
            name={cameraName}
            streamUrl="/hls/stream.m3u8"
            ptzApiUrl="/api/ptz"
          />
        </div>

        <footer className="mt-6 text-center text-xs text-zinc-600 sm:mt-8">
          JCam · câmera IP com PTZ
        </footer>
      </div>
    </main>
  );
}
