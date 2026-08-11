/**
 * Viewfinder caméra pour l'écran Scanner (mobile uniquement).
 *
 * Le composant n'est monté que lorsque l'utilisateur appuie sur
 * « Prendre une photo » : la permission caméra est donc demandée à ce moment
 * précis, jamais au chargement de la page. Si la permission est refusée (ou
 * qu'aucune caméra n'existe), on remonte la raison au parent, qui affiche un
 * message clair et bascule sur l'import galerie.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

export type CameraErrorReason = "permission" | "notfound" | "generic";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  onPermissionDenied: (reason: CameraErrorReason) => void;
}

/** Taille max de la capture (les photos 12 MP inutiles ralentissent l'IA). */
const MAX_CAPTURE_DIM = 1920;

export default function CameraCapture({
  onCapture,
  onClose,
  onPermissionDenied,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );

  // Les callbacks sont stockés dans une ref pour ne pas relancer l'effet de
  // démarrage de la caméra à chaque rendu du parent.
  const onPermissionDeniedRef = useRef(onPermissionDenied);
  onPermissionDeniedRef.current = onPermissionDenied;

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // Caméra arrière : celle qui photographie la feuille.
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari exige un play() explicite (playsInline + muted).
          await video.play().catch(() => {});
        }
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const name = e instanceof DOMException ? e.name : "";
        const reason: CameraErrorReason =
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "permission"
            : name === "NotFoundError" || name === "DevicesNotFoundError"
              ? "notfound"
              : "generic";
        onPermissionDeniedRef.current(reason);
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || status !== "ready") return;

    let w = video.videoWidth;
    let h = video.videoHeight;
    const longest = Math.max(w, h);
    if (longest > MAX_CAPTURE_DIM) {
      const scale = MAX_CAPTURE_DIM / longest;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <div className="relative aspect-[3/4] w-full">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 size-full object-cover"
          />

          {/* Cadre de guidage : aligner la feuille dans les coins */}
          <div className="pointer-events-none absolute inset-x-4 bottom-10 top-10 sm:inset-x-8">
            <div className="absolute inset-0 rounded-2xl border border-white/25" />
            <span className="absolute -left-px -top-px size-9 rounded-tl-2xl border-l-4 border-t-4 border-white" />
            <span className="absolute -right-px -top-px size-9 rounded-tr-2xl border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-px -left-px size-9 rounded-bl-2xl border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-px -right-px size-9 rounded-br-2xl border-b-4 border-r-4 border-white" />
          </div>

          <p className="pointer-events-none absolute inset-x-4 top-3 text-center text-xs font-semibold text-white/85 drop-shadow">
            Aligne la feuille dans le cadre
          </p>

          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="size-7 animate-spin text-white" />
              <p className="text-sm font-medium text-white/85">
                Démarrage de la caméra…
              </p>
            </div>
          )}
        </div>

        {/* Contrôles */}
        <div className="grid grid-cols-3 items-center px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            <X className="size-4" />
            Annuler
          </button>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={status !== "ready"}
              aria-label="Prendre la photo"
              className="flex size-16 items-center justify-center rounded-full border-4 border-white/90 transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="size-12 rounded-full bg-white" />
            </button>
          </div>

          <div aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
