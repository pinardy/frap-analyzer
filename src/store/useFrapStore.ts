import { create } from "zustand";
import type {
  AlignOptions,
  Calibration,
  DiffusionResult,
  FitResult,
  Frame,
  FrameMeasurement,
  FrameShift,
  Roi,
  RoiKind,
  SourceFile,
} from "../types";
import { concatSources, sortSourcesByName } from "../lib/concat";
import { registerStack } from "../lib/register";
import { computeMeasurements, detectBleachFrame, type RoiSet } from "../lib/frap";
import { fitRecovery } from "../lib/fit";
import { diffusionCoefficient } from "../lib/diffusion";
import { umPerPixelFromLine } from "../lib/calibration";
import { displayWindowFor } from "../lib/tiff";
import { makeDemoData } from "../lib/demo";

export type Tool = "none" | "bleach" | "background" | "reference" | "scale";

interface FrapState {
  sources: SourceFile[];
  frames: Frame[]; // concatenated, pre-alignment
  aligned: Frame[] | null;
  shifts: FrameShift[] | null;

  currentFrame: number;
  displayMin: number;
  displayMax: number;
  displayCeiling: number; // slider max for the loaded bit depth (255 or 65535)
  showRaw: boolean; // in AlignPanel: view pre-alignment frames

  calibration: Calibration;
  rois: { bleach?: Roi; background?: Roi; reference?: Roi };
  activeTool: Tool;
  roiShape: "circle" | "rect";
  bleachFrame: number;
  alignOptions: AlignOptions;

  measurements: FrameMeasurement[] | null;
  fit: FitResult | null;
  diffusion: DiffusionResult | null;
  status: string;

  workingFrames: () => Frame[];

  addSources: (sources: SourceFile[]) => void;
  removeSource: (index: number) => void;
  sortSources: () => void;
  concatenate: () => void;
  setCurrentFrame: (i: number) => void;
  setDisplay: (min: number, max: number) => void;
  setShowRaw: (v: boolean) => void;
  setCalibration: (patch: Partial<Calibration>) => void;
  setScaleLine: (
    line: { x1: number; y1: number; x2: number; y2: number },
    lengthUm: number,
  ) => void;
  clearScaleLine: () => void;
  setActiveTool: (t: Tool) => void;
  setRoiShape: (s: "circle" | "rect") => void;
  setRoi: (kind: RoiKind, roi: Roi) => void;
  clearRoi: (kind: RoiKind) => void;
  setBleachFrame: (i: number) => void;
  setAlignOptions: (patch: Partial<AlignOptions>) => void;
  autoDetectBleach: () => void;
  runAlign: () => void;
  runAnalysis: () => void;
  loadDemo: () => void;
  reset: () => void;
}

const initialCalibration: Calibration = {
  umPerPixel: 0,
  secondsPerFrame: 1,
};

export const useFrapStore = create<FrapState>((set, get) => ({
  sources: [],
  frames: [],
  aligned: null,
  shifts: null,

  currentFrame: 0,
  displayMin: 0,
  displayMax: 255,
  displayCeiling: 255,
  showRaw: false,

  calibration: { ...initialCalibration },
  rois: {},
  activeTool: "none",
  roiShape: "circle",
  bleachFrame: 0,
  alignOptions: { referenceFrame: 0, subpixel: true, autoCrop: false },

  measurements: null,
  fit: null,
  diffusion: null,
  status: "",

  workingFrames: () => {
    const s = get();
    return s.aligned ?? s.frames;
  },

  addSources: (sources) =>
    set((s) => ({ sources: [...s.sources, ...sources], status: "" })),

  removeSource: (index) =>
    set((s) => ({ sources: s.sources.filter((_, i) => i !== index) })),

  sortSources: () => set((s) => ({ sources: sortSourcesByName(s.sources) })),

  concatenate: () => {
    try {
      const frames = concatSources(get().sources);
      const win = displayWindowFor(frames);
      set({
        frames,
        aligned: null,
        shifts: null,
        currentFrame: 0,
        displayMin: win.min,
        displayMax: win.max,
        displayCeiling: win.ceiling,
        measurements: null,
        fit: null,
        diffusion: null,
        status: `Concatenated ${frames.length} frames.`,
      });
    } catch (e) {
      set({ status: (e as Error).message });
    }
  },

  setCurrentFrame: (i) => {
    const n = get().workingFrames().length;
    set({ currentFrame: Math.max(0, Math.min(i, Math.max(0, n - 1))) });
  },

  setDisplay: (min, max) => set({ displayMin: min, displayMax: max }),
  setShowRaw: (v) => set({ showRaw: v }),

  setCalibration: (patch) =>
    set((s) => ({ calibration: { ...s.calibration, ...patch } })),

  setScaleLine: (line, lengthUm) =>
    set((s) => ({
      calibration: {
        ...s.calibration,
        scaleLine: line,
        scaleLengthUm: lengthUm,
        umPerPixel: umPerPixelFromLine(
          line.x1,
          line.y1,
          line.x2,
          line.y2,
          lengthUm,
        ),
      },
    })),

  clearScaleLine: () =>
    set((s) => {
      const calibration = { ...s.calibration };
      delete calibration.scaleLine;
      return { calibration };
    }),

  setActiveTool: (t) => set({ activeTool: t }),
  setRoiShape: (s) => set({ roiShape: s }),

  setRoi: (kind, roi) =>
    set((s) => ({ rois: { ...s.rois, [kind]: roi } })),

  clearRoi: (kind) =>
    set((s) => {
      const rois = { ...s.rois };
      delete rois[kind];
      return { rois };
    }),

  setBleachFrame: (i) => set({ bleachFrame: Math.max(0, i) }),

  setAlignOptions: (patch) =>
    set((s) => ({ alignOptions: { ...s.alignOptions, ...patch } })),

  autoDetectBleach: () => {
    const { rois } = get();
    if (!rois.bleach || !rois.background) {
      set({ status: "Place bleach and background ROIs first." });
      return;
    }
    const frames = get().workingFrames();
    const idx = detectBleachFrame(frames, {
      bleach: rois.bleach,
      background: rois.background,
      reference: rois.reference ?? rois.background,
    });
    set({ bleachFrame: idx, status: `Detected bleach at frame ${idx}.` });
  },

  runAlign: () => {
    const { frames, alignOptions } = get();
    if (frames.length === 0) {
      set({ status: "Concatenate images before aligning." });
      return;
    }
    const { aligned, shifts } = registerStack(frames, alignOptions);
    set({
      aligned,
      shifts,
      currentFrame: 0,
      measurements: null,
      fit: null,
      diffusion: null,
      status: `Aligned ${aligned.length} frames to frame ${alignOptions.referenceFrame}.`,
    });
  },

  runAnalysis: () => {
    const { rois, calibration, bleachFrame } = get();
    if (!rois.bleach || !rois.background || !rois.reference) {
      set({
        status: "Place all three ROIs (bleach, background, reference) first.",
      });
      return;
    }
    const frames = get().workingFrames();
    const roiSet: RoiSet = {
      bleach: rois.bleach,
      background: rois.background,
      reference: rois.reference,
    };
    const measurements = computeMeasurements(
      frames,
      roiSet,
      bleachFrame,
      calibration.secondsPerFrame,
    );
    const fit = fitRecovery(measurements, bleachFrame);
    const diffusion =
      fit && calibration.umPerPixel > 0
        ? diffusionCoefficient(
            rois.bleach,
            calibration.umPerPixel,
            fit.halfTime,
          )
        : null;
    set({
      measurements,
      fit,
      diffusion,
      status: fit
        ? "Analysis complete."
        : "Not enough post-bleach frames to fit a recovery curve.",
    });
  },

  loadDemo: () => {
    const demo = makeDemoData();
    set({
      sources: [{ name: "demo-stack.tif", frames: demo.frames }],
      frames: demo.frames,
      aligned: null,
      shifts: null,
      currentFrame: 0,
      displayMin: 0,
      displayMax: 255,
      displayCeiling: 255,
      calibration: demo.calibration,
      rois: {
        bleach: demo.bleachRoi,
        background: demo.backgroundRoi,
        reference: demo.referenceRoi,
      },
      bleachFrame: demo.bleachFrame,
      alignOptions: { referenceFrame: 0, subpixel: true, autoCrop: false },
      measurements: null,
      fit: null,
      diffusion: null,
      status: `Loaded demo (truth: mobile ${demo.truth.mobileFraction}, t½ ${demo.truth.halfTime.toFixed(2)}s). Run Align then Analyze.`,
    });
    get().runAlign();
    get().runAnalysis();
  },

  reset: () =>
    set({
      sources: [],
      frames: [],
      aligned: null,
      shifts: null,
      currentFrame: 0,
      displayMin: 0,
      displayMax: 255,
      displayCeiling: 255,
      calibration: { ...initialCalibration },
      rois: {},
      activeTool: "none",
      bleachFrame: 0,
      measurements: null,
      fit: null,
      diffusion: null,
      status: "",
    }),
}));
