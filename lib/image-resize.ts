"use client";

// Photos straight from a phone are often 4000+ pixels and several MB, which
// makes the website slow. Before uploading, large JPEG/PNG/WebP images are
// scaled down to at most MAX_SIZE pixels on their longest side.
const MAX_SIZE = 2400;
const MIN_BYTES = 400 * 1024;
const QUALITY = 0.82;
const RESIZABLE = ["image/jpeg", "image/png", "image/webp"];

export const shrinkImage = async (file: File): Promise<File> => {
  if (!RESIZABLE.includes(file.type) || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the phone's rotation (EXIF) so photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_SIZE && file.size <= MIN_BYTES) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_SIZE / longest);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type, file.type === "image/png" ? undefined : QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
};
