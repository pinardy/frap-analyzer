import { describe, expect, it } from "vitest";
import type { Frame, Roi } from "../types";
import { effectiveRadiusPx, meanIntensity, pixelInRoi } from "./roi";

function uniformFrame(w: number, h: number, value: number): Frame {
  return {
    width: w,
    height: h,
    data: new Uint8Array(w * h).fill(value),
    maxValue: 255,
  };
}

describe("roi", () => {
  it("computes mean over a uniform region", () => {
    const f = uniformFrame(10, 10, 100);
    const roi: Roi = { kind: "bleach", shape: "rect", x: 2, y: 2, w: 4, h: 4 };
    expect(meanIntensity(f, roi)).toBe(100);
  });

  it("averages only pixels inside a circle", () => {
    const f = uniformFrame(20, 20, 0);
    // set a 3x3 block around (10,10) to 90
    for (let y = 9; y <= 11; y++)
      for (let x = 9; x <= 11; x++) f.data[y * 20 + x] = 90;
    const roi: Roi = { kind: "bleach", shape: "circle", cx: 10.5, cy: 10.5, r: 2 };
    const m = meanIntensity(f, roi);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(90);
  });

  it("pixelInRoi respects circle boundary", () => {
    const roi: Roi = { kind: "bleach", shape: "circle", cx: 5, cy: 5, r: 3 };
    expect(pixelInRoi(roi, 4, 4)).toBe(true);
    expect(pixelInRoi(roi, 0, 0)).toBe(false);
  });

  it("area-equivalent radius for a rectangle", () => {
    const roi: Roi = { kind: "bleach", shape: "rect", x: 0, y: 0, w: 10, h: 10 };
    const { r, fromRect } = effectiveRadiusPx(roi);
    expect(fromRect).toBe(true);
    expect(r).toBeCloseTo(Math.sqrt(100 / Math.PI), 5);
  });
});
