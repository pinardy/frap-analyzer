import * as UTIF from "utif";
import type { Frame, SourceFile } from "../types";

/** Decode one TIFF file (possibly multi-page) into grayscale frames.
 * Uses UTIF.toRGBA8 so 8-bit grayscale, 16-bit, and RGB all decode; for
 * 8-bit grayscale the luminance equals the native sample value exactly. */
export async function loadTiffFile(file: File): Promise<SourceFile> {
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  const frames: Frame[] = [];
  for (const ifd of ifds) {
    UTIF.decodeImage(buf, ifd, ifds);
    const w: number = ifd.width;
    const h: number = ifd.height;
    const rgba: Uint8Array = UTIF.toRGBA8(ifd);
    const data = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = rgba[4 * i];
      const g = rgba[4 * i + 1];
      const b = rgba[4 * i + 2];
      data[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    frames.push({ width: w, height: h, data });
  }
  if (frames.length === 0) {
    throw new Error(`No image pages found in ${file.name}`);
  }
  return { name: file.name, frames };
}

export async function loadTiffFiles(files: File[]): Promise<SourceFile[]> {
  return Promise.all(files.map(loadTiffFile));
}

/** Render a frame to an ImageData applying a display window (min/max). */
export function frameToImageData(
  frame: Frame,
  displayMin: number,
  displayMax: number,
): ImageData {
  const { width, height, data } = frame;
  const img = new ImageData(width, height);
  const range = Math.max(1, displayMax - displayMin);
  for (let i = 0; i < width * height; i++) {
    let v = ((data[i] - displayMin) / range) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    const o = i * 4;
    img.data[o] = v;
    img.data[o + 1] = v;
    img.data[o + 2] = v;
    img.data[o + 3] = 255;
  }
  return img;
}
