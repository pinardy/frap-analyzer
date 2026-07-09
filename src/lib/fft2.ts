import FFT from "fft.js";

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Interleaved complex plane: length 2*w*h, [re,im] per pixel, row-major. */
export interface ComplexPlane {
  data: Float64Array;
  w: number;
  h: number;
}

export function makePlane(w: number, h: number): ComplexPlane {
  return { data: new Float64Array(2 * w * h), w, h };
}

/** Load a real image into a complex plane, zero-padded to (w,h). */
export function realToPlane(
  src: ArrayLike<number>,
  srcW: number,
  srcH: number,
  w: number,
  h: number,
): ComplexPlane {
  const plane = makePlane(w, h);
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      plane.data[(y * w + x) * 2] = src[y * srcW + x];
    }
  }
  return plane;
}

function transformRows(plane: ComplexPlane, fft: FFT, inverse: boolean) {
  const { data, w, h } = plane;
  const tmp = fft.createComplexArray();
  const out = fft.createComplexArray();
  for (let y = 0; y < h; y++) {
    const base = y * w * 2;
    for (let i = 0; i < w * 2; i++) tmp[i] = data[base + i];
    if (inverse) fft.inverseTransform(out, tmp);
    else fft.transform(out, tmp);
    for (let i = 0; i < w * 2; i++) data[base + i] = out[i];
  }
}

function transformCols(plane: ComplexPlane, fft: FFT, inverse: boolean) {
  const { data, w, h } = plane;
  const tmp = fft.createComplexArray();
  const out = fft.createComplexArray();
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      tmp[2 * y] = data[(y * w + x) * 2];
      tmp[2 * y + 1] = data[(y * w + x) * 2 + 1];
    }
    if (inverse) fft.inverseTransform(out, tmp);
    else fft.transform(out, tmp);
    for (let y = 0; y < h; y++) {
      data[(y * w + x) * 2] = out[2 * y];
      data[(y * w + x) * 2 + 1] = out[2 * y + 1];
    }
  }
}

/** In-place 2D FFT. w and h must be powers of two. inverse=false: forward. */
export function fft2(plane: ComplexPlane, inverse: boolean) {
  const fftW = new FFT(plane.w);
  const fftH = new FFT(plane.h);
  transformRows(plane, fftW, inverse);
  transformCols(plane, fftH, inverse);
  if (inverse) {
    // fft.js inverse transforms are unnormalized; divide by N.
    const n = plane.w * plane.h;
    for (let i = 0; i < plane.data.length; i++) plane.data[i] /= n;
  }
}
