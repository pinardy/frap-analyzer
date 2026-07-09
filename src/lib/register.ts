import type { AlignOptions, Frame, FrameShift } from "../types";
import { fft2, nextPow2, realToPlane, type ComplexPlane } from "./fft2";

/** Apply a Hann window in place (reduces FFT edge artifacts for correlation). */
function applyHann(plane: ComplexPlane, srcW: number, srcH: number) {
  for (let y = 0; y < srcH; y++) {
    const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * y) / Math.max(1, srcH - 1));
    for (let x = 0; x < srcW; x++) {
      const wx = 0.5 - 0.5 * Math.cos((2 * Math.PI * x) / Math.max(1, srcW - 1));
      plane.data[(y * plane.w + x) * 2] *= wx * wy;
    }
  }
}

/** Parabolic subpixel peak offset from 3 samples (left, center, right). */
function parabolicOffset(left: number, center: number, right: number): number {
  const denom = left - 2 * center + right;
  if (denom === 0) return 0;
  const d = (0.5 * (left - right)) / denom;
  return Math.abs(d) < 1 ? d : 0;
}

/**
 * Estimate the translation that aligns `mov` onto `ref` via phase correlation.
 * Returns the shift (dx, dy) to pass to `shiftImage(mov, dx, dy)`.
 */
export function estimateShift(
  ref: Frame,
  mov: Frame,
  subpixel = true,
): FrameShift {
  const W = nextPow2(ref.width);
  const H = nextPow2(ref.height);

  const A = realToPlane(ref.data, ref.width, ref.height, W, H);
  const B = realToPlane(mov.data, mov.width, mov.height, W, H);
  applyHann(A, ref.width, ref.height);
  applyHann(B, mov.width, mov.height);

  fft2(A, false);
  fft2(B, false);

  // Cross-power spectrum R = A * conj(B) / |A * conj(B)|.
  const R = { data: new Float64Array(2 * W * H), w: W, h: H };
  for (let i = 0; i < W * H; i++) {
    const ar = A.data[2 * i];
    const ai = A.data[2 * i + 1];
    const br = B.data[2 * i];
    const bi = B.data[2 * i + 1];
    // A * conj(B)
    const re = ar * br + ai * bi;
    const im = ai * br - ar * bi;
    const mag = Math.hypot(re, im) || 1;
    R.data[2 * i] = re / mag;
    R.data[2 * i + 1] = im / mag;
  }

  fft2(R, true);

  // Find peak of the real correlation surface.
  let peak = -Infinity;
  let px = 0;
  let py = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = R.data[(y * W + x) * 2];
      if (v > peak) {
        peak = v;
        px = x;
        py = y;
      }
    }
  }

  const at = (x: number, y: number) =>
    R.data[(((y + H) % H) * W + ((x + W) % W)) * 2];

  let sx = 0;
  let sy = 0;
  if (subpixel) {
    sx = parabolicOffset(at(px - 1, py), peak, at(px + 1, py));
    sy = parabolicOffset(at(px, py - 1), peak, at(px, py + 1));
  }

  // Fold the peak index into a signed offset. This folded value is exactly the
  // shift to apply via shiftImage(mov, dx, dy) to align `mov` back onto `ref`
  // (verified against known shifts in register.test.ts).
  let dx = px + sx;
  let dy = py + sy;
  if (dx > W / 2) dx -= W;
  if (dy > H / 2) dy -= H;
  return { dx, dy };
}

/** Shift a frame so output(x,y) = input(x - dx, y - dy); zero-fill outside.
 * Integer shifts copy exactly; fractional shifts use bilinear interpolation. */
export function shiftImage(frame: Frame, dx: number, dy: number): Frame {
  const { width, height, data, maxValue } = frame;
  const out =
    data instanceof Uint16Array
      ? new Uint16Array(width * height)
      : new Uint8Array(width * height);
  const integer = Number.isInteger(dx) && Number.isInteger(dy);

  if (integer) {
    for (let y = 0; y < height; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= height) continue;
      for (let x = 0; x < width; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= width) continue;
        out[y * width + x] = data[sy * width + sx];
      }
    }
    return { width, height, data: out, maxValue };
  }

  for (let y = 0; y < height; y++) {
    const fy = y - dy;
    const y0 = Math.floor(fy);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = x - dx;
      const x0 = Math.floor(fx);
      const wx = fx - x0;
      const v00 = sample(data, width, height, x0, y0);
      const v10 = sample(data, width, height, x0 + 1, y0);
      const v01 = sample(data, width, height, x0, y0 + 1);
      const v11 = sample(data, width, height, x0 + 1, y0 + 1);
      const top = v00 * (1 - wx) + v10 * wx;
      const bot = v01 * (1 - wx) + v11 * wx;
      out[y * width + x] = Math.round(top * (1 - wy) + bot * wy);
    }
  }
  return { width, height, data: out, maxValue };
}

function sample(
  data: Uint8Array | Uint16Array,
  w: number,
  h: number,
  x: number,
  y: number,
): number {
  if (x < 0 || x >= w || y < 0 || y >= h) return 0;
  return data[y * w + x];
}

/** Crop every frame to the rectangle valid across all applied shifts. */
function autoCropStack(frames: Frame[], shifts: FrameShift[]): Frame[] {
  const w = frames[0].width;
  const h = frames[0].height;
  let left = 0;
  let right = w;
  let top = 0;
  let bottom = h;
  for (const s of shifts) {
    // content moved by (dx,dy); valid region is the overlap.
    left = Math.max(left, Math.ceil(Math.max(0, s.dx)));
    right = Math.min(right, w + Math.floor(Math.min(0, s.dx)));
    top = Math.max(top, Math.ceil(Math.max(0, s.dy)));
    bottom = Math.min(bottom, h + Math.floor(Math.min(0, s.dy)));
  }
  const cw = Math.max(1, right - left);
  const ch = Math.max(1, bottom - top);
  if (cw === w && ch === h) return frames;
  return frames.map((f) => {
    const data =
      f.data instanceof Uint16Array
        ? new Uint16Array(cw * ch)
        : new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        data[y * cw + x] = f.data[(y + top) * w + (x + left)];
      }
    }
    return { width: cw, height: ch, data, maxValue: f.maxValue };
  });
}

export interface RegisterResult {
  aligned: Frame[];
  shifts: FrameShift[];
}

/** Register a whole stack to a reference frame (translation only). */
export function registerStack(
  frames: Frame[],
  options: AlignOptions,
): RegisterResult {
  if (frames.length === 0) return { aligned: [], shifts: [] };
  const refIdx = Math.min(
    Math.max(0, options.referenceFrame),
    frames.length - 1,
  );
  const ref = frames[refIdx];
  const shifts: FrameShift[] = [];
  const aligned: Frame[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (i === refIdx) {
      shifts.push({ dx: 0, dy: 0 });
      aligned.push(frames[i]);
      continue;
    }
    let { dx, dy } = estimateShift(ref, frames[i], options.subpixel);
    if (!options.subpixel) {
      dx = Math.round(dx);
      dy = Math.round(dy);
    }
    shifts.push({ dx, dy });
    aligned.push(shiftImage(frames[i], dx, dy));
  }

  const finalFrames = options.autoCrop ? autoCropStack(aligned, shifts) : aligned;
  return { aligned: finalFrames, shifts };
}
