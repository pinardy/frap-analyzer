import type { DiffusionResult, Roi } from "../types";
import { effectiveRadiusPx } from "./roi";

/**
 * Diffusion coefficient from the bleach-spot radius and recovery half-time,
 * using the Soumpasis (1983) approximation for a uniform circular bleach:
 *
 *   D = 0.224 * w^2 / t_half
 *
 * where w is the bleach radius (µm) and t_half the recovery half-time (s).
 * This is an approximation; it assumes negligible diffusion during bleaching
 * and a circular bleach geometry. Rectangular ROIs use an area-equivalent
 * radius and are flagged.
 */
export function diffusionCoefficient(
  bleachRoi: Roi,
  umPerPixel: number,
  halfTimeSeconds: number,
): DiffusionResult | null {
  if (umPerPixel <= 0 || !isFinite(halfTimeSeconds) || halfTimeSeconds <= 0) {
    return null;
  }
  const { r, fromRect } = effectiveRadiusPx(bleachRoi);
  const radiusUm = r * umPerPixel;
  const D = (0.224 * radiusUm * radiusUm) / halfTimeSeconds;
  return { radiusUm, D, fromRect };
}
