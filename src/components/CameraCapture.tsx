/**
 * Viewfinder caméra pour l'écran Scanner (mobile uniquement).
 *
 * Le composant n'est monté que lorsque l'utilisateur appuie sur
 * « Prendre une photo » : la permission caméra est donc demandée à ce moment
 * précis, jamais au chargement de la page. Si la permission est refusée (ou
 * qu'aucune caméra n'existe), on remonte la raison au parent, qui affiche un
 * message clair et bascule sur l'import galerie.
 *
 * Cadre portrait / paysage :
 * - le cadre de guidage suit automatiquement l'orientation de l'appareil
 *   (événement `orientationchange` / `resize`) ;
 * - l'utilisateur peut forcer Portrait ou Paysage via les deux pastilles, et
 *   revenir au suivi automatique avec le bouton « Auto » ;
 * - quand le cadre forcé contredit l'orientation réelle du téléphone, un
 *   message discret invite à tourner l'appareil pour un cadrage plein écran.
 *
 * Rotation de la capture :
 * - sur Safari iOS, le <video> affiche le flux correctement orienté mais
 *   `drawImage` dessine l'image brute (souvent paysage natif) : on compare
 *   l'aspect affiché à l'aspect natif du flux et, en cas d'écart, on pivote
 *   le canvas de 90° pour que la photo corresponde au cadre vu par l'élève.
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

type FrameOrientation = "portrait" | "landscape";

/** Orientation réelle de l'appareil, sans dépendre de `screen.orientation`. */
function getDeviceOrientation(): FrameOrientation {
  if (typeof window === "undefined") return "portrait";
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(orientation: portrait)").matches) return "portrait";
    if (window.matchMedia("(orientation: landscape)").matches) return "landscape";
  }
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

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
  const [deviceOrientation, setDeviceOrientation] =
    useState<FrameOrientation>(() => getDeviceOrientation());
  /** Cadre forcé par l'utilisateur ; `null` = suivre l'appareil. */
  const [manualOverride, setManualOverride] = useState<FrameOrientation | null>(
    null,
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

  // Suivi de l'orientation de l'appareil (rotation du téléphone).
  useEffect(() => {
    const update = () => setDeviceOrientation(getDeviceOrientation());
    update();
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const frame: FrameOrientation = manualOverride ?? deviceOrientation;
  const isPortrait = frame === "portrait";
  const showRotationHint =
    manualOverride !== null && manualOverride !== deviceOrientation;

  /** Force un cadre ; retaper le cadre actif revient au suivi automatique. */
  const setFrame = (f: FrameOrientation) => {
    setManualOverride((prev) => (prev === f ? null : f));
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || status !== "ready") return;

    const nw = video.videoWidth;
    const nh = video.videoHeight;

    // Safari iOS affiche le flux pivoté mais `drawImage` dessine le flux
    // brut : si l'aspect affiché (le cadre) ne correspond pas à l'aspect
    // natif, on compense la rotation dans le canvas.
    const displayedLandscape = video.clientWidth > video.clientHeight;
    const nativeLandscape = nw > nh;
    const needsRotation = displayedLandscape !== nativeLandscape;

    let w = needsRotation ? nh : nw;
    let h = needsRotation ? nw : nh;

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

    if (needsRotation) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(video, -h / 2, -w / 2, h, w);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

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

  const pill = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
      active ? "bg-white text-black" : "text-white/80 hover:text-white"
    }`;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <div
          className={`relative w-full overflow-hidden bg-black transition-all duration-300 ease-out ${
            isPortrait ? "aspect-[3/4]" : "aspect-[4/3]"
          }`}
        >
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

          {/* Conseil de rotation : le cadre forcé contredit l'orientation du
              téléphone → tourner l'appareil pour un cadrage plein écran. */}
          {showRotationHint && (
            <div className="absolute inset-x-4 top-12 z-10 flex items-center justify-center gap-2">
              <p className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium leading-4 text-white/90 backdrop-blur-sm">
                💡{" "}
                {frame === "landscape"
                  ? "Tourne ton téléphone à l'horizontale pour un cadrage plein écran"
                  : "Remets ton téléphone à la verticale pour un cadrage plein écran"}
              </p>
              <button
                type="button"
                onClick={() => setManualOverride(null)}
                className="rounded-full bg-white/15 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                aria-label="Suivre automatiquement l'orientation de l'appareil"
              >
                Auto
              </button>
            </div>
          )}

          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="size-7 animate-spin text-white" />
              <p className="text-sm font-medium text-white/85">
                Démarrage de la caméra…
              </p>
            </div>
          )}
        </div>

        {/* Cadre portrait / paysage : suit l'orientation du téléphone, ou le
            choix manuel de l'élève (re-taper le cadre actif → Auto). */}
        <div className="flex items-center justify-center border-t border-white/10 px-5 py-2.5">
          <div
            className="flex rounded-full border border-white/20 bg-white/10 p-0.5"
            role="group"
            aria-label="Orientation du cadre de capture"
          >
            <button
              type="button"
              onClick={() => setFrame("portrait")}
              aria-pressed={isPortrait}
              className={pill(isPortrait)}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setFrame("landscape")}
              aria-pressed={!isPortrait}
              className={pill(!isPortrait)}
            >
              Paysage
            </button>
          </div>
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
        </div>
      </div>
    </div>
  );
}
