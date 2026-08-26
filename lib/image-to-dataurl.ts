import type { PageImage } from "./types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image for dimension check"));
    img.src = dataUrl;
  });
}

export async function convertImageToPages(file: File): Promise<PageImage[]> {
  const dataUrl = await readFileAsDataUrl(file);
  const { width, height } = await getImageDimensions(dataUrl);
  return [{ dataUrl, width, height }];
}
