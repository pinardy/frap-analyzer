import * as UTIF from "utif";
import type { Frame, SourceFile } from "../types";

/** Decode a single already-decoded IFD into a grayscale Frame.
 *
 * Native 16-bit and 8-bit grayscale are read straight from the raw samples so
 * measurements keep full precision — UTIF.toRGBA8 would collapse 16-bit data to
 * its high byte (256 levels), which biases quantitative FRAP results. After
 * UTIF.decodeImage, `ifd.data` holds the samples little-endian, one channel,
 * with no row padding for these depths. Anything else (RGB, palette, other
 * depths) falls back to an 8-bit luminance conversion. */
function ifdToFrame(ifd: {
  width: number;
  height: number;
  data: Uint8Array;
  t258?: number[];
  t277?: number[];
  t262?: number[];
}): Frame {
  const w = ifd.width;
  const h = ifd.height;
  const n = w * h;
  const bitsPerSample = ifd.t258 ? ifd.t258[0] : 8;
  const samplesPerPixel = ifd.t277 ? ifd.t277[0] : 1;
  // Photometric interpretation: 0 = WhiteIsZero (inverted), 1 = BlackIsZero.
  const photometric = ifd.t262 ? ifd.t262[0] : 1;
  const grayscale =
    samplesPerPixel === 1 && (photometric === 0 || photometric === 1);
  const invert = photometric === 0;

  if (grayscale && bitsPerSample === 16) {
    const bytes = ifd.data;
    const data = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      const v = bytes[2 * i] | (bytes[2 * i + 1] << 8);
      data[i] = invert ? 65535 - v : v;
    }
    return { width: w, height: h, data, maxValue: 65535 };
  }

  if (grayscale && bitsPerSample === 8) {
    const bytes = ifd.data;
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) data[i] = invert ? 255 - bytes[i] : bytes[i];
    return { width: w, height: h, data, maxValue: 255 };
  }

  const rgba: Uint8Array = UTIF.toRGBA8(ifd);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[4 * i];
    const g = rgba[4 * i + 1];
    const b = rgba[4 * i + 2];
    data[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return { width: w, height: h, data, maxValue: 255 };
}

/** Decode a TIFF byte buffer (possibly multi-page) into grayscale frames. */
export function decodeTiffBuffer(
  buf: ArrayBuffer,
  name: string,
): SourceFile {
  const ifds = UTIF.decode(buf);
  const frames: Frame[] = [];
  for (const ifd of ifds) {
    UTIF.decodeImage(buf, ifd, ifds);
    frames.push(ifdToFrame(ifd));
  }
  if (frames.length === 0) {
    throw new Error(`No image pages found in ${name}`);
  }
  return { name, frames };
}

/** Decode one TIFF file (possibly multi-page) into grayscale frames. */
export async function loadTiffFile(file: File): Promise<SourceFile> {
  return decodeTiffBuffer(await file.arrayBuffer(), file.name);
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

/** Min and max sample value across a stack (for auto-windowing). */
export function frameStackRange(frames: Frame[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return isFinite(min) ? { min, max } : { min: 0, max: 255 };
}

/** Choose the initial display window and slider ceiling for a loaded stack.
 * 8-bit keeps the full 0–255 window; 16-bit auto-windows to the actual data
 * range so sub-range (e.g. 12-bit) captures don't render near-black. */
export function displayWindowFor(frames: Frame[]): {
  min: number;
  max: number;
  ceiling: number;
} {
  const ceiling = frames[0]?.maxValue ?? 255;
  if (ceiling <= 255) return { min: 0, max: ceiling, ceiling };
  const { min, max } = frameStackRange(frames);
  return { min, max: Math.max(min + 1, max), ceiling };
}
