import { describe, expect, it } from "vitest";
import type { Frame, Roi } from "../types";
import { computeMeasurements, detectBleachFrame, type RoiSet } from "./frap";

// 3x1 frames: pixel0=bleach, pixel1=background, pixel2=reference.
function f(bleach: number, bg: number, ref: number): Frame {
  return { width: 3, height: 1, data: new Uint8Array([bleach, bg, ref]) };
}

const rois: RoiSet = {
  bleach: { kind: "bleach", shape: "rect", x: 0, y: 0, w: 1, h: 1 } as Roi,
  background: { kind: "background", shape: "rect", x: 1, y: 0, w: 1, h: 1 } as Roi,
  reference: { kind: "reference", shape: "rect", x: 2, y: 0, w: 1, h: 1 } as Roi,
};

const frames = [
  f(100, 10, 100), // pre
  f(100, 10, 100), // pre
  f(30, 10, 100), // bleach dip
  f(60, 10, 100), // recovering
  f(55, 10, 55), // both signal halved (acquisition bleaching test)
];

describe("frap double normalization", () => {
  it("detects the bleach frame at the largest drop", () => {
    expect(detectBleachFrame(frames, rois)).toBe(2);
  });

  it("normalizes pre-bleach to ~1 and follows the dip/recovery", () => {
    const m = computeMeasurements(frames, rois, 2, 1);
    expect(m[0].normalized).toBeCloseTo(1, 5);
    expect(m[2].normalized).toBeCloseTo(20 / 90, 4);
    expect(m[3].normalized).toBeCloseTo(50 / 90, 4);
  });

  it("reference term corrects for acquisition photobleaching", () => {
    const m = computeMeasurements(frames, rois, 2, 1);
    // frame 4 has bleach & reference both halved -> normalized stays ~1
    expect(m[4].normalized).toBeCloseTo(1, 5);
  });

  it("assigns time from the frame interval", () => {
    const m = computeMeasurements(frames, rois, 2, 2.5);
    expect(m[3].time).toBe(7.5);
  });
});
