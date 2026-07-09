import type { Calibration, Frame, FrameShift, Roi } from "../types";

/** Deterministic PRNG (mulberry32) so the demo/tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoData {
  frames: Frame[];
  drift: FrameShift[];
  bleachRoi: Roi;
  backgroundRoi: Roi;
  referenceRoi: Roi;
  bleachFrame: number;
  calibration: Calibration;
  truth: { mobileFraction: number; halfTime: number; k: number };
}

export interface DemoParams {
  width?: number;
  height?: number;
  frameCount?: number;
  preBleach?: number;
  depth?: number; // bleach depth 0..1
  mobileFraction?: number;
  k?: number; // recovery rate 1/s
  kAcq?: number; // acquisition photobleaching rate 1/s
  secondsPerFrame?: number;
  umPerPixel?: number;
  maxDrift?: number; // px
  noise?: number; // additive noise amplitude
  seed?: number;
}

/**
 * Synthesize a FRAP image stack with a KNOWN recovery, acquisition
 * photobleaching, and per-frame drift. Content is generated at a drifting
 * center so registration should recover the negated drift, and after
 * alignment + double-normalization the fit should return `truth`.
 */
export function makeDemoData(params: DemoParams = {}): DemoData {
  const width = params.width ?? 220;
  const height = params.height ?? 180;
  const frameCount = params.frameCount ?? 60;
  const preBleach = params.preBleach ?? 5;
  const depth = params.depth ?? 0.8;
  const mobileFraction = params.mobileFraction ?? 0.7;
  const k = params.k ?? 0.15;
  const kAcq = params.kAcq ?? 0.004;
  const dt = params.secondsPerFrame ?? 1;
  const umPerPixel = params.umPerPixel ?? 0.2;
  const maxDrift = params.maxDrift ?? 4;
  const noise = params.noise ?? 1;
  const rand = mulberry32(params.seed ?? 12345);

  const CELL = 185; // raw cell intensity
  const BG = 12; // raw background intensity
  const cellR = 70;
  const cx0 = 110;
  const cy0 = 90;
  const bleachOffset = { x: -20, y: 0 }; // bleach spot relative to cell center
  const refOffset = { x: 40, y: 0 }; // reference relative to cell center
  const spotR = 12;

  // ROIs are fixed in image coordinates, anchored at the frame-0 geometry.
  const bleachRoi: Roi = {
    kind: "bleach",
    shape: "circle",
    cx: cx0 + bleachOffset.x,
    cy: cy0 + bleachOffset.y,
    r: spotR,
  };
  const referenceRoi: Roi = {
    kind: "reference",
    shape: "circle",
    cx: cx0 + refOffset.x,
    cy: cy0 + refOffset.y,
    r: spotR,
  };
  const backgroundRoi: Roi = {
    kind: "background",
    shape: "rect",
    x: 5,
    y: 5,
    w: 24,
    h: 24,
  };

  const drift: FrameShift[] = [];
  const frames: Frame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = i * dt;
    const dx = i === 0 ? 0 : (rand() * 2 - 1) * maxDrift;
    const dy = i === 0 ? 0 : (rand() * 2 - 1) * maxDrift;
    drift.push({ dx, dy });

    const cx = cx0 + dx;
    const cy = cy0 + dy;
    const bcx = cx + bleachOffset.x;
    const bcy = cy + bleachOffset.y;

    const acq = Math.exp(-kAcq * t);
    let bnorm = 1;
    if (i >= preBleach) {
      const tp = (i - preBleach) * dt;
      bnorm = 1 - depth + mobileFraction * depth * (1 - Math.exp(-k * tp));
    }

    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inCell =
          (x - cx) * (x - cx) + (y - cy) * (y - cy) <= cellR * cellR;
        let val = BG;
        if (inCell) {
          const inBleach =
            (x - bcx) * (x - bcx) + (y - bcy) * (y - bcy) <= spotR * spotR;
          const signal = (CELL - BG) * acq * (inBleach ? bnorm : 1);
          val = BG + signal;
        }
        val += (rand() * 2 - 1) * noise;
        data[y * width + x] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
    frames.push({ width, height, data, maxValue: 255 });
  }

  return {
    frames,
    drift,
    bleachRoi,
    backgroundRoi,
    referenceRoi,
    bleachFrame: preBleach,
    calibration: { umPerPixel, secondsPerFrame: dt },
    truth: { mobileFraction, halfTime: Math.log(2) / k, k },
  };
}
