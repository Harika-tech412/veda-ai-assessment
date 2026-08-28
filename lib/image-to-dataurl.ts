import type { PageImage } from "./types";

// Keeps photo uploads in the same resolution ballpark as our PDF-page
// renders (2x-scale A4 lands around 1650x2340) instead of sending a phone
// camera's full 12MP+ resolution straight to Gemini.
const MAX_LONGEST_SIDE = 2400;
const JPEG_QUALITY = 0.92;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export async function convertImageToPages(file: File): Promise<PageImage[]> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const longestSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longestSide > MAX_LONGEST_SIDE ? MAX_LONGEST_SIDE / longestSide : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  // Drawing through a canvas (rather than passing the file's raw bytes
  // straight through) bakes in two fixes at once:
  // 1. EXIF orientation — phones tag rotated photos with a metadata flag
  //    rather than physically rotating the pixels. Browsers apply that flag
  //    when decoding for <img>/drawImage, so the canvas we draw onto here
  //    is always right-side-up — we're no longer relying on Gemini to
  //    honor orientation metadata on the raw file itself.
  // 2. Size — full camera-resolution photos (12MP+) are capped down to
  //    MAX_LONGEST_SIDE and re-encoded as JPEG instead of passed through
  //    at their original size/format, which is what was pushing real
  //    handwritten answer sheets over the upload limit.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2D canvas context for image normalization");
  }
  context.drawImage(img, 0, 0, width, height);

  return [
    {
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      width,
      height,
    },
  ];
}
