import { useEffect, useRef, useState } from "react";
import { useFrapStore } from "../store/useFrapStore";
import type { Roi, RoiKind } from "../types";

const KINDS: { kind: RoiKind; label: string; color: string; hint: string }[] = [
  { kind: "bleach", label: "Bleach", color: "#ff5d5d", hint: "the bleached spot" },
  {
    kind: "background",
    label: "Background",
    color: "#ffd24a",
    hint: "outside the cell",
  },
  {
    kind: "reference",
    label: "Reference",
    color: "#5dffa0",
    hint: "unbleached cell area",
  },
];

const fmt = (n: number) =>
  Number.isFinite(n) ? (Math.round(n * 1e4) / 1e4).toString() : "";

interface Fields {
  x: string;
  y: string;
  s1: string; // circle: diameter; rect: width  (in display unit)
  s2: string; // rect: height (in display unit)
}

// Display unit = µm when calibrated, else px. `conv` = µm/px (or 1 uncalibrated).
function roiToFields(roi: Roi, conv: number): Fields {
  if (roi.shape === "circle")
    return { x: fmt(roi.cx), y: fmt(roi.cy), s1: fmt(2 * roi.r * conv), s2: "" };
  return {
    x: fmt(roi.x),
    y: fmt(roi.y),
    s1: fmt(roi.w * conv),
    s2: fmt(roi.h * conv),
  };
}

function fieldsToRoi(
  f: Fields,
  kind: RoiKind,
  shape: "circle" | "rect",
  conv: number,
): Roi | null {
  const x = parseFloat(f.x);
  const y = parseFloat(f.y);
  if (!isFinite(x) || !isFinite(y)) return null;
  if (shape === "circle") {
    const d = parseFloat(f.s1);
    if (!isFinite(d) || d <= 0) return null;
    return { kind, shape: "circle", cx: x, cy: y, r: d / conv / 2 };
  }
  const w = parseFloat(f.s1);
  const h = parseFloat(f.s2);
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null;
  return { kind, shape: "rect", x, y, w: w / conv, h: h / conv };
}

function roiClose(a: Roi, b: Roi): boolean {
  if (a.shape !== b.shape) return false;
  const eq = (p: number, q: number) => Math.abs(p - q) < 1e-4;
  if (a.shape === "circle" && b.shape === "circle")
    return eq(a.cx, b.cx) && eq(a.cy, b.cy) && eq(a.r, b.r);
  if (a.shape === "rect" && b.shape === "rect")
    return eq(a.x, b.x) && eq(a.y, b.y) && eq(a.w, b.w) && eq(a.h, b.h);
  return false;
}

function RoiEditor({ kind, roi }: { kind: RoiKind; roi: Roi }) {
  const setRoi = useFrapStore((s) => s.setRoi);
  const umPerPixel = useFrapStore((s) => s.calibration.umPerPixel);
  const conv = umPerPixel > 0 ? umPerPixel : 1;
  const unit = umPerPixel > 0 ? "µm" : "px";
  const step = umPerPixel > 0 ? 0.01 : 1;

  const [fields, setFields] = useState<Fields>(() => roiToFields(roi, conv));
  const lastRoi = useRef(roi);
  const lastConv = useRef(conv);

  // Resync the inputs only when the ROI changes from outside (drawn on canvas)
  // or the calibration changes — never while the user is typing here.
  useEffect(() => {
    const derived = fieldsToRoi(fields, kind, roi.shape, conv);
    const external = !derived || !roiClose(derived, roi);
    if ((roi !== lastRoi.current || conv !== lastConv.current) && external) {
      setFields(roiToFields(roi, conv));
    }
    lastRoi.current = roi;
    lastConv.current = conv;
  });

  const update = (patch: Partial<Fields>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    const r = fieldsToRoi(next, kind, roi.shape, conv);
    if (r) setRoi(kind, r);
  };

  const areaUm2 =
    umPerPixel > 0
      ? roi.shape === "circle"
        ? Math.PI * roi.r * roi.r * conv * conv
        : roi.w * roi.h * conv * conv
      : null;

  const numStyle = { width: 60 } as const;

  return (
    <div
      style={{
        background: "var(--panel-2)",
        borderRadius: 6,
        padding: 8,
        marginTop: 4,
      }}
    >
      <div className="row">
        <label style={{ width: 70 }}>Center (px)</label>
        <input
          type="number"
          style={numStyle}
          value={fields.x}
          onChange={(e) => update({ x: e.target.value })}
        />
        <input
          type="number"
          style={numStyle}
          value={fields.y}
          onChange={(e) => update({ y: e.target.value })}
        />
      </div>

      {roi.shape === "circle" ? (
        <div className="row">
          <label style={{ width: 70 }}>Ø diameter</label>
          <input
            type="number"
            step={step}
            min={0}
            style={numStyle}
            value={fields.s1}
            onChange={(e) => update({ s1: e.target.value })}
          />
          <span>{unit}</span>
        </div>
      ) : (
        <>
          <div className="row">
            <label style={{ width: 70 }}>Width</label>
            <input
              type="number"
              step={step}
              min={0}
              style={numStyle}
              value={fields.s1}
              onChange={(e) => update({ s1: e.target.value })}
            />
            <span>{unit}</span>
          </div>
          <div className="row">
            <label style={{ width: 70 }}>Height</label>
            <input
              type="number"
              step={step}
              min={0}
              style={numStyle}
              value={fields.s2}
              onChange={(e) => update({ s2: e.target.value })}
            />
            <span>{unit}</span>
            <button onClick={() => update({ s2: fields.s1 })}>Square</button>
          </div>
        </>
      )}

      {areaUm2 != null ? (
        <small className="note" style={{ marginTop: 2 }}>
          area = {(Math.round(areaUm2 * 1e4) / 1e4).toString()} µm²
        </small>
      ) : (
        <small className="note" style={{ marginTop: 2 }}>
          Set the spatial scale (Calibrate) to enter sizes in µm.
        </small>
      )}
    </div>
  );
}

export default function RoiPanel() {
  const activeTool = useFrapStore((s) => s.activeTool);
  const setActiveTool = useFrapStore((s) => s.setActiveTool);
  const roiShape = useFrapStore((s) => s.roiShape);
  const setRoiShape = useFrapStore((s) => s.setRoiShape);
  const rois = useFrapStore((s) => s.rois);
  const setRoi = useFrapStore((s) => s.setRoi);
  const clearRoi = useFrapStore((s) => s.clearRoi);
  const firstFrame = useFrapStore((s) => (s.aligned ?? s.frames)[0]);
  const umPerPixel = useFrapStore((s) => s.calibration.umPerPixel);

  const addAtCenter = (kind: RoiKind) => {
    const w = firstFrame?.width ?? 100;
    const h = firstFrame?.height ?? 100;
    const cx = w / 2;
    const cy = h / 2;
    // default size ~1 µm if calibrated, else 20 px
    const sizePx = umPerPixel > 0 ? 1 / umPerPixel : 20;
    if (roiShape === "circle") {
      setRoi(kind, { kind, shape: "circle", cx, cy, r: sizePx / 2 });
    } else {
      setRoi(kind, {
        kind,
        shape: "rect",
        x: cx - sizePx / 2,
        y: cy - sizePx / 2,
        w: sizePx,
        h: sizePx,
      });
    }
  };

  return (
    <div className="panel">
      <h2>4 · ROIs</h2>
      <div className="row">
        <label>New ROI shape</label>
        <div className="btn-row">
          <button
            className={roiShape === "circle" ? "active" : ""}
            onClick={() => setRoiShape("circle")}
          >
            Circle
          </button>
          <button
            className={roiShape === "rect" ? "active" : ""}
            onClick={() => setRoiShape("rect")}
          >
            Rectangle
          </button>
        </div>
      </div>
      {KINDS.map(({ kind, label, color, hint }) => (
        <div key={kind} style={{ marginBottom: 10 }}>
          <div className="row" style={{ marginBottom: 2 }}>
            <span className="chip" style={{ background: color }} />
            <button
              className={activeTool === kind ? "active" : ""}
              onClick={() => setActiveTool(activeTool === kind ? "none" : kind)}
              style={{ flex: 1, textAlign: "left" }}
            >
              {activeTool === kind ? `Drawing ${label}…` : `Draw ${label}`}
            </button>
            {!rois[kind] && (
              <button onClick={() => addAtCenter(kind)}>＋ Add</button>
            )}
            {rois[kind] && <button onClick={() => clearRoi(kind)}>✕</button>}
          </div>
          {rois[kind] ? (
            <RoiEditor kind={kind} roi={rois[kind]!} />
          ) : (
            <small className="note" style={{ marginTop: 0 }}>
              not set — {hint}
            </small>
          )}
        </div>
      ))}
      <small className="note">
        Draw on the image or type exact values here. Sizes are in µm once
        calibrated — e.g. a 0.5 µm square = Width 0.5, Height 0.5. Use a circular
        bleach ROI for the diffusion estimate.
      </small>
    </div>
  );
}
