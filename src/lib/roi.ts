import type { Frame, Roi } from "../types";

/** Is the pixel center (px+0.5, py+0.5) inside the ROI? */
export function pixelInRoi(roi: Roi, px: number, py: number): boolean {
  const x = px + 0.5;
  const y = py + 0.5;
  if (roi.shape === "circle") {
    const dx = x - roi.cx;
    const dy = y - roi.cy;
    return dx * dx + dy * dy <= roi.r * roi.r;
  }
  return x >= roi.x && x < roi.x + roi.w && y >= roi.y && y < roi.y + roi.h;
}

/** Integer pixel bounds [x0,x1) x [y0,y1) that enclose the ROI, clamped to frame. */
function roiBounds(roi: Roi, width: number, height: number) {
  let x0: number, y0: number, x1: number, y1: number;
  if (roi.shape === "circle") {
    x0 = Math.floor(roi.cx - roi.r);
    x1 = Math.ceil(roi.cx + roi.r);
    y0 = Math.floor(roi.cy - roi.r);
    y1 = Math.ceil(roi.cy + roi.r);
  } else {
    x0 = Math.floor(roi.x);
    x1 = Math.ceil(roi.x + roi.w);
    y0 = Math.floor(roi.y);
    y1 = Math.ceil(roi.y + roi.h);
  }
  return {
    x0: Math.max(0, x0),
    y0: Math.max(0, y0),
    x1: Math.min(width, x1),
    y1: Math.min(height, y1),
  };
}

/** Mean intensity of all pixels whose center falls inside the ROI. */
export function meanIntensity(frame: Frame, roi: Roi): number {
  const { x0, y0, x1, y1 } = roiBounds(roi, frame.width, frame.height);
  let sum = 0;
  let count = 0;
  for (let py = y0; py < y1; py++) {
    const row = py * frame.width;
    for (let px = x0; px < x1; px++) {
      if (pixelInRoi(roi, px, py)) {
        sum += frame.data[row + px];
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

/** Effective radius (pixels) of an ROI: circle -> r; rect -> area-equivalent. */
export function effectiveRadiusPx(roi: Roi): { r: number; fromRect: boolean } {
  if (roi.shape === "circle") return { r: roi.r, fromRect: false };
  const area = roi.w * roi.h;
  return { r: Math.sqrt(area / Math.PI), fromRect: true };
}
