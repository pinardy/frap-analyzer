import { useEffect, useRef, useState } from "react";
import { useFrapStore, type Tool } from "../store/useFrapStore";
import { frameToImageData } from "../lib/tiff";
import type { Roi, RoiKind } from "../types";

const ROI_COLORS: Record<RoiKind, string> = {
  bleach: "#ff5d5d",
  background: "#ffd24a",
  reference: "#5dffa0",
};

interface Draft {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function roiContains(roi: Roi, x: number, y: number): boolean {
  if (roi.shape === "circle")
    return (x - roi.cx) ** 2 + (y - roi.cy) ** 2 <= roi.r * roi.r;
  return x >= roi.x && x <= roi.x + roi.w && y >= roi.y && y <= roi.y + roi.h;
}

function shiftRoi(roi: Roi, dx: number, dy: number): Roi {
  if (roi.shape === "circle") return { ...roi, cx: roi.cx + dx, cy: roi.cy + dy };
  return { ...roi, x: roi.x + dx, y: roi.y + dy };
}

// Grab the smallest/topmost ROI under the cursor first.
const HIT_ORDER: RoiKind[] = ["bleach", "reference", "background"];
function hitTestRoi(
  rois: { bleach?: Roi; background?: Roi; reference?: Roi },
  x: number,
  y: number,
): RoiKind | null {
  for (const kind of HIT_ORDER) {
    const r = rois[kind];
    if (r && roiContains(r, x, y)) return kind;
  }
  return null;
}

export default function ImageViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const frames = useFrapStore((s) => s.frames);
  const aligned = useFrapStore((s) => s.aligned);
  const showRaw = useFrapStore((s) => s.showRaw);
  const currentFrame = useFrapStore((s) => s.currentFrame);
  const displayMin = useFrapStore((s) => s.displayMin);
  const displayMax = useFrapStore((s) => s.displayMax);
  const rois = useFrapStore((s) => s.rois);
  const scaleLine = useFrapStore((s) => s.calibration.scaleLine);
  const activeTool = useFrapStore((s) => s.activeTool);
  const roiShape = useFrapStore((s) => s.roiShape);
  const setRoi = useFrapStore((s) => s.setRoi);
  const setCalibration = useFrapStore((s) => s.setCalibration);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const panState = useRef<{ sx: number; sy: number; px: number; py: number } | null>(
    null,
  );
  const moveState = useRef<{
    kind: RoiKind;
    startX: number;
    startY: number;
    orig: Roi;
  } | null>(null);

  const displayFrames = showRaw ? frames : aligned ?? frames;
  const frame = displayFrames[currentFrame];

  // Fit-to-view whenever the image dimensions change.
  useEffect(() => {
    if (!frame || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const s = Math.min(cw / frame.width, ch / frame.height) * 0.95 || 1;
    setScale(s);
    setPan({
      x: (cw - frame.width * s) / 2,
      y: (ch - frame.height * s) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.width, frame?.height]);

  const draw = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, cw, ch);
    if (!frame) return;

    // Offscreen native-resolution frame.
    if (
      !offscreenRef.current ||
      offscreenRef.current.width !== frame.width ||
      offscreenRef.current.height !== frame.height
    ) {
      const off = document.createElement("canvas");
      off.width = frame.width;
      off.height = frame.height;
      offscreenRef.current = off;
    }
    const off = offscreenRef.current;
    const octx = off.getContext("2d")!;
    octx.putImageData(frameToImageData(frame, displayMin, displayMax), 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    ctx.drawImage(off, 0, 0);
    ctx.restore();

    // Overlays (screen space).
    const toScreen = (ix: number, iy: number) => ({
      x: ix * scale + pan.x,
      y: iy * scale + pan.y,
    });

    const drawRoi = (roi: Roi, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (roi.shape === "circle") {
        const c = toScreen(roi.cx, roi.cy);
        ctx.arc(c.x, c.y, roi.r * scale, 0, 2 * Math.PI);
      } else {
        const p = toScreen(roi.x, roi.y);
        ctx.rect(p.x, p.y, roi.w * scale, roi.h * scale);
      }
      ctx.stroke();
    };

    (Object.keys(rois) as RoiKind[]).forEach((k) => {
      const r = rois[k];
      if (r) drawRoi(r, ROI_COLORS[k]);
    });

    if (scaleLine) {
      const a = toScreen(scaleLine.x1, scaleLine.y1);
      const b = toScreen(scaleLine.x2, scaleLine.y2);
      ctx.strokeStyle = "#c88bff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draft preview.
    if (draft) {
      const color =
        activeTool === "scale"
          ? "#c88bff"
          : ROI_COLORS[activeTool as RoiKind] ?? "#4aa3ff";
      ctx.strokeStyle = color;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = toScreen(draft.x1, draft.y1);
      const b = toScreen(draft.x2, draft.y2);
      if (activeTool === "scale") {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      } else if (roiShape === "circle") {
        const r = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) * scale;
        ctx.arc(a.x, a.y, r, 0, 2 * Math.PI);
      } else {
        ctx.rect(
          Math.min(a.x, b.x),
          Math.min(a.y, b.y),
          Math.abs(b.x - a.x),
          Math.abs(b.y - a.y),
        );
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(draw);

  const imagePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { x: (sx - pan.x) / scale, y: (sy - pan.y) / scale };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "none") {
      const p = imagePos(e);
      const hit = hitTestRoi(rois, p.x, p.y);
      if (hit) {
        moveState.current = {
          kind: hit,
          startX: p.x,
          startY: p.y,
          orig: rois[hit]!,
        };
        return;
      }
      panState.current = {
        sx: e.clientX,
        sy: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      return;
    }
    const p = imagePos(e);
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (moveState.current) {
      const p = imagePos(e);
      const { kind, startX, startY, orig } = moveState.current;
      setRoi(kind, shiftRoi(orig, p.x - startX, p.y - startY));
      return;
    }
    if (panState.current) {
      setPan({
        x: panState.current.px + (e.clientX - panState.current.sx),
        y: panState.current.py + (e.clientY - panState.current.sy),
      });
      return;
    }
    if (draft) {
      const p = imagePos(e);
      setDraft({ ...draft, x2: p.x, y2: p.y });
      return;
    }
    // hover cursor: show "move" when over a draggable ROI
    if (activeTool === "none" && canvasRef.current) {
      const p = imagePos(e);
      canvasRef.current.style.cursor = hitTestRoi(rois, p.x, p.y)
        ? "move"
        : "grab";
    }
  };

  const commit = () => {
    if (!draft) return;
    if (activeTool === "scale") {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= 2) {
        setCalibration({
          scaleLine: { x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 },
        });
      }
    } else if (activeTool !== "none") {
      const kind = activeTool as RoiKind;
      if (roiShape === "circle") {
        const r = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1);
        if (r >= 1)
          setRoi(kind, { kind, shape: "circle", cx: draft.x1, cy: draft.y1, r });
      } else {
        const x = Math.min(draft.x1, draft.x2);
        const y = Math.min(draft.y1, draft.y2);
        const w = Math.abs(draft.x2 - draft.x1);
        const h = Math.abs(draft.y2 - draft.y1);
        if (w >= 1 && h >= 1)
          setRoi(kind, { kind, shape: "rect", x, y, w, h });
      }
    }
    setDraft(null);
  };

  const onMouseUp = () => {
    panState.current = null;
    moveState.current = null;
    commit();
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(0.05, Math.min(64, scale * factor));
    // keep the point under the cursor fixed
    const ix = (sx - pan.x) / scale;
    const iy = (sy - pan.y) / scale;
    setScale(newScale);
    setPan({ x: sx - ix * newScale, y: sy - iy * newScale });
  };

  const toolHint = (t: Tool) => {
    if (t === "none")
      return "Drag an ROI to move it · drag empty space to pan · scroll to zoom";
    if (t === "scale") return "Drag a line over a known length";
    if (roiShape === "circle")
      return `Draw ${t} ROI: click center, drag to set radius`;
    return `Draw ${t} ROI: drag a rectangle`;
  };

  return (
    <div
      className="viewer-wrap"
      ref={containerRef}
      onMouseLeave={onMouseUp}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onWheel={onWheel}
        style={{ cursor: activeTool === "none" ? "grab" : "crosshair" }}
      />
      {frame ? (
        <div className="viewer-hint">
          {frame.width}×{frame.height} · frame {currentFrame + 1}/
          {displayFrames.length} · {Math.round(scale * 100)}% · {toolHint(activeTool)}
          {showRaw && aligned ? " · (raw / pre-alignment)" : ""}
        </div>
      ) : (
        <div className="viewer-hint">
          Load a TIFF stack (or the demo) to begin.
        </div>
      )}
    </div>
  );
}
