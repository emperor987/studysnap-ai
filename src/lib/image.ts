/**
 * Compression / redimensionnement des photos avant envoi à l'IA.
 *
 * Les photos de smartphone (3-12 MP) représentent des milliers de tokens
 * image pour le modèle vision : les réduire à 1280 px de côté maximum en
 * JPEG (~qualité 0.82) divise fortement le temps d'analyse et la taille
 * des uploads. Les formats non décodables par canvas (ex: HEIC sur Chrome)
 * sont renvoyés tels quels, sans erreur.
 */

export async function downscaleImage(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);

    // Déjà assez petit et léger : on garde l'original (aucun gain).
    if (longest <= maxDim && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");

    // Fond blanc : le JPEG n'a pas de canal alpha, et les devoirs sont
    // presque toujours sur fond clair.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    // Le ré-encodage n'a rien gagné : on garde le fichier d'origine.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Format non décodable par canvas : on transmet l'original.
    return file;
  }
}
