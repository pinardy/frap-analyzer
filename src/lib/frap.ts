import type { Frame, FrameMeasurement, Roi } from "../types";
import { meanIntensity } from "./roi";

export interface RoiSet {
  bleach: Roi;
  background: Roi;
  reference: Roi;
}

/** Detect the first post-bleach frame = index of the largest drop in the
 * background-corrected bleach signal relative to the previous frame. */
export function detectBleachFrame(frames: Frame[], rois: RoiSet): number {
  if (frames.length < 2) return 0;
  let worstDrop = 0;
  let idx = 1;
  let prev =
    meanIntensity(frames[0], rois.bleach) -
    meanIntensity(frames[0], rois.background);
  for (let i = 1; i < frames.length; i++) {
    const cur =
      meanIntensity(frames[i], rois.bleach) -
      meanIntensity(frames[i], rois.background);
    const drop = prev - cur;
    if (drop > worstDrop) {
      worstDrop = drop;
      idx = i;
    }
    prev = cur;
  }
  return idx;
}

/**
 * Full FRAP double normalization.
 *
 * For each frame t with bleach/background/reference means I_b, I_bg, I_r:
 *   Ib(t) = I_b(t) - I_bg(t)          (background-corrected bleach)
 *   Ir(t) = I_r(t) - I_bg(t)          (background-corrected reference)
 * Averaging over pre-bleach frames [0, bleachFrame) gives Ib_pre, Ir_pre, then
 *   Inorm(t) = (Ir_pre / Ir(t)) * (Ib(t) / Ib_pre)
 * which is ~1 before bleaching, dips at the bleach, and recovers. The
 * reference term corrects for acquisition (imaging-induced) photobleaching.
 */
export function computeMeasurements(
  frames: Frame[],
  rois: RoiSet,
  bleachFrame: number,
  secondsPerFrame: number,
): FrameMeasurement[] {
  const n = frames.length;
  const bleach = new Array<number>(n);
  const background = new Array<number>(n);
  const reference = new Array<number>(n);
  const bleachCorr = new Array<number>(n);
  const refCorr = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    bleach[i] = meanIntensity(frames[i], rois.bleach);
    background[i] = meanIntensity(frames[i], rois.background);
    reference[i] = meanIntensity(frames[i], rois.reference);
    bleachCorr[i] = bleach[i] - background[i];
    refCorr[i] = reference[i] - background[i];
  }

  const preEnd = Math.max(1, Math.min(bleachFrame, n));
  let ibPre = 0;
  let irPre = 0;
  for (let i = 0; i < preEnd; i++) {
    ibPre += bleachCorr[i];
    irPre += refCorr[i];
  }
  ibPre /= preEnd;
  irPre /= preEnd;

  const out: FrameMeasurement[] = [];
  for (let i = 0; i < n; i++) {
    const refTerm = refCorr[i] !== 0 ? irPre / refCorr[i] : 0;
    const bleachTerm = ibPre !== 0 ? bleachCorr[i] / ibPre : 0;
    out.push({
      frame: i,
      time: i * secondsPerFrame,
      bleach: bleach[i],
      background: background[i],
      reference: reference[i],
      bleachCorr: bleachCorr[i],
      refCorr: refCorr[i],
      normalized: refTerm * bleachTerm,
    });
  }
  return out;
}
