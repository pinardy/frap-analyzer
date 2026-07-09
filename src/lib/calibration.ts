/** Spatial calibration: derive micrometers-per-pixel from a drawn line of
 * known real-world length. Mirrors ImageJ "Set Scale". */
export function umPerPixelFromLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  knownLengthUm: number,
): number {
  const lengthPx = Math.hypot(x2 - x1, y2 - y1);
  if (lengthPx <= 0) return 0;
  return knownLengthUm / lengthPx;
}

export function lineLengthPx(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.hypot(x2 - x1, y2 - y1);
}
