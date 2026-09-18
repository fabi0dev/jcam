import CameraViewer from "@/components/CameraViewer";

export default function Home() {
  const cameraName = process.env.CAMERA_NAME || "Câmera";

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
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
