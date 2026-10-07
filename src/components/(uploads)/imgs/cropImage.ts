export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export async function cropImage(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotation = 0,
  mimeType = "image/png"
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto del canvas");

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) throw new Error("No se pudo obtener el contexto del canvas recortado");

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Fondo transparente (áreas del recorte sin imagen quedan transparentes)
  croppedCtx.clearRect(0, 0, pixelCrop.width, pixelCrop.height);

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  const outputType = mimeType === "image/jpeg" ? "image/jpeg" : mimeType === "image/webp" ? "image/webp" : "image/png";

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Error al generar la imagen recortada"));
          return;
        }
        resolve(blob);
      },
      outputType,
      outputType === "image/jpeg" || outputType === "image/webp" ? 0.92 : undefined
    );
  });
}
