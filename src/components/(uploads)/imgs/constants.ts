export const OBS_ORG_LOGOS_BUCKET = "obs-organizaciones-logos";

/** Contenedor del logo: sin fondo en claro; padding y esquinas redondeadas */
export const ORG_LOGO_SURFACE_CLASS = "bg-transparent rounded-lg p-1.5";

/** Placa blanca sólida detrás del logo — solo tema oscuro (cintillo, etc.) */
export const ORG_LOGO_DARK_PLATE_CLASS =
  "dark:bg-white dark:rounded-xl dark:shadow-[0_2px_14px_rgba(0,0,0,0.35)]";

/** Contorno blanco en los bordes del logo — solo tema oscuro (sin placa) */
export const ORG_LOGO_IMG_GLOW_CLASS =
  "dark:[filter:drop-shadow(0_0_0.5px_rgba(255,255,255,1))_drop-shadow(0_0_1.5px_rgba(255,255,255,0.95))_drop-shadow(0_0_3px_rgba(255,255,255,0.55))]";

export function getStoragePublicUrl(bucketName: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const cleanPath = path.replace(/^\//, "");
  const encodedPath = cleanPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucketName}/${encodedPath}`;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function getExtFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function fileToJpeg(file: File, maxDim: number, quality: number): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo comprimir la imagen");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Error al comprimir JPEG"))),
        "image/jpeg",
        quality
      );
    });

    return new File([blob], "logo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToPng(file: File, maxDim: number): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo comprimir la imagen PNG");

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Error al comprimir PNG"))),
        "image/png"
      );
    });

    return new File([blob], "image.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToWebp(file: File, maxDim: number, quality: number = 0.85): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo comprimir la imagen WebP");

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Error al comprimir WebP"))),
        "image/webp",
        quality
      );
    });

    return new File([blob], "image.webp", { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Comprime una imagen hasta quedar bajo maxSizeMB. Manteniendo el formato PNG o WebP si corresponde. */
export async function compressImageFile(file: File, maxSizeMB: number = 0.2, maxDimension: number = 1024): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");

  const isPng = file.type === "image/png";
  const isWebp = file.type === "image/webp";
  const targetType = isPng ? "image/png" : isWebp ? "image/webp" : file.type;
  const MAX_BYTES = maxSizeMB * 1024 * 1024;
  const dimensions = [
    maxDimension,
    Math.round(maxDimension * 0.75),
    Math.round(maxDimension * 0.6),
    Math.round(maxDimension * 0.5),
    Math.round(maxDimension * 0.4),
    Math.round(maxDimension * 0.3)
  ];

  for (const maxDim of dimensions) {
    const compressed = await imageCompression(file, {
      maxSizeMB: maxSizeMB,
      maxWidthOrHeight: maxDim,
      useWebWorker: true,
      fileType: targetType,
      initialQuality: isWebp ? 0.95 : 0.85,
    });

    if (compressed.size <= MAX_BYTES) {
      const ext = getExtFromMime(targetType);
      return new File([compressed], `image.${ext}`, { type: targetType });
    }
  }

  if (isPng) {
    for (const maxDim of dimensions) {
      const pngFile = await fileToPng(file, maxDim);
      if (pngFile.size <= MAX_BYTES) return pngFile;
    }
  } else if (isWebp) {
    const webpQualities = [0.95, 0.90, 0.85, 0.75, 0.65, 0.55];
    for (const maxDim of dimensions) {
      for (const quality of webpQualities) {
        const webpFile = await fileToWebp(file, maxDim, quality);
        if (webpFile.size <= MAX_BYTES) return webpFile;
      }
    }
  } else {
    const jpegQualities = [0.92, 0.88, 0.8, 0.72, 0.64, 0.55, 0.48];
    for (const maxDim of dimensions) {
      for (const quality of jpegQualities) {
        const jpeg = await fileToJpeg(file, maxDim, quality);
        if (jpeg.size <= MAX_BYTES) return jpeg;
      }
    }
  }

  throw new Error(
    `No se pudo comprimir la imagen por debajo de ${maxSizeMB * 1024} KB. Intente recortar más o usar una imagen más simple.`
  );
}

export function generateStoragePath(mimeType: string): string {
  const ext = getExtFromMime(mimeType);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}
