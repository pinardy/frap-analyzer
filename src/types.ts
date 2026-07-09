// Core data types for the FRAP analysis pipeline.

/** A single grayscale image frame (one timepoint). `data` holds the raw
 * sample values (length = width*height) used for all measurements —
 * never the display-adjusted pixels. 8-bit images use a Uint8Array; 16-bit
 * images keep full precision in a Uint16Array. */
export interface Frame {
  width: number;
  height: number;
  data: Uint8Array | Uint16Array; // grayscale samples, row-major, length width*height
  /** white-point ceiling for this frame's bit depth: 255 for 8-bit, 65535 for
   * 16-bit. Bounds the display window; measurements use the raw samples. */
  maxValue: number;
}

/** A decoded source file: its pages become consecutive frames. */
export interface SourceFile {
  name: string;
  frames: Frame[];
}

export type RoiKind = "bleach" | "background" | "reference";

/** ROI geometry in IMAGE-pixel coordinates (independent of zoom/pan). */
export type Roi =
  | { kind: RoiKind; shape: "circle"; cx: number; cy: number; r: number }
  | {
      kind: RoiKind;
      shape: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
    };

export interface Calibration {
  /** micrometers per pixel; 0/undefined means uncalibrated. */
  umPerPixel: number;
  /** seconds between consecutive frames. */
  secondsPerFrame: number;
  /** the scale line drawn by the user, in image pixels (for display/redo). */
  scaleLine?: { x1: number; y1: number; x2: number; y2: number };
  /** the real-world length the scale line represents, in micrometers. */
  scaleLengthUm?: number;
}

export interface AlignOptions {
  referenceFrame: number;
  subpixel: boolean;
  /** crop the whole stack to the region valid across all frames. */
  autoCrop: boolean;
}

export interface FrameShift {
  dx: number;
  dy: number;
}

/** Per-frame measured means for the three ROIs. */
export interface FrameMeasurement {
  frame: number;
  time: number; // seconds
  bleach: number;
  background: number;
  reference: number;
  /** background-subtracted bleach & reference. */
  bleachCorr: number;
  refCorr: number;
  /** double-normalized recovery value (~1 pre-bleach). */
  normalized: number;
}

export interface FitResult {
  /** F(t') = fInf - (fInf - f0) * exp(-k t') */
  f0: number;
  fInf: number;
  k: number; // 1/s
  halfTime: number; // s, ln2/k
  mobileFraction: number; // 0..1
  immobileFraction: number; // 0..1
  rSquared: number;
  /** fitted curve sampled for plotting. */
  curve: { time: number; value: number }[];
}

export interface DiffusionResult {
  /** effective bleach radius used, in micrometers. */
  radiusUm: number;
  /** diffusion coefficient in um^2/s (Soumpasis: D = 0.224 w^2 / t_half). */
  D: number;
  /** true if radius came from an area-equivalent rectangle (approximation). */
  fromRect: boolean;
}
