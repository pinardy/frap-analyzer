import { describe, expect, it } from "vitest";
import { lineLengthPx, umPerPixelFromLine } from "./calibration";
import { diffusionCoefficient } from "./diffusion";
import type { Roi } from "../types";

describe("calibration", () => {
  it("derives um/pixel from a horizontal line", () => {
    // 100 px line = 10 um -> 0.1 um/px
    expect(umPerPixelFromLine(0, 0, 100, 0, 10)).toBeCloseTo(0.1, 6);
  });

  it("uses euclidean length for diagonal lines", () => {
    expect(lineLengthPx(0, 0, 3, 4)).toBe(5);
    expect(umPerPixelFromLine(0, 0, 3, 4, 10)).toBeCloseTo(2, 6);
  });

  it("returns 0 for a zero-length line", () => {
    expect(umPerPixelFromLine(5, 5, 5, 5, 10)).toBe(0);
  });
});

describe("diffusion", () => {
  it("applies the Soumpasis formula", () => {
    const roi: Roi = { kind: "bleach", shape: "circle", cx: 0, cy: 0, r: 10 };
    // r=10 px, 0.2 um/px -> w=2 um; t_half=4 s -> D = 0.224*4/4 = 0.224
    const d = diffusionCoefficient(roi, 0.2, 4);
    expect(d).not.toBeNull();
    expect(d!.radiusUm).toBeCloseTo(2, 6);
    expect(d!.D).toBeCloseTo((0.224 * 4) / 4, 6);
  });

  it("returns null without calibration", () => {
    const roi: Roi = { kind: "bleach", shape: "circle", cx: 0, cy: 0, r: 10 };
    expect(diffusionCoefficient(roi, 0, 4)).toBeNull();
  });
});
