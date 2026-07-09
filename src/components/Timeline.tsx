import { useEffect, useRef, useState } from "react";
import { useFrapStore } from "../store/useFrapStore";
import { frameToImageData } from "../lib/tiff";

const THUMB_H = 60;
const GAP = 4;
const LABEL_H = 14;

export default function Timeline() {
  const frames = useFrapStore((s) => s.frames);
  const aligned = useFrapStore((s) => s.aligned);
  const showRaw = useFrapStore((s) => s.showRaw);
  const currentFrame = useFrapStore((s) => s.currentFrame);
  const setCurrentFrame = useFrapStore((s) => s.setCurrentFrame);
  const bleachFrame = useFrapStore((s) => s.bleachFrame);
  const displayMin = useFrapStore((s) => s.displayMin);
  const displayMax = useFrapStore((s) => s.displayMax);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(true);

  const displayFrames = showRaw ? frames : aligned ?? frames;
  const n = displayFrames.length;
  const first = displayFrames[0];
  const thumbW = first
    ? Math.max(24, Math.min(120, Math.round((THUMB_H * first.width) / first.height)))
    : 60;
  const step = thumbW + GAP;
  const contentW = n * step + GAP;
  const canvasH = THUMB_H + LABEL_H + 6;

  // Rebuild the static thumbnail cache when the stack or display window changes.
  useEffect(() => {
    if (n === 0) return;
    const cache = document.createElement("canvas");
    cache.width = contentW;
    cache.height = canvasH;
    const ctx = cache.getContext("2d")!;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, contentW, canvasH);
    ctx.imageSmoothingEnabled = false;

    const native = document.createElement("canvas");
    for (let i = 0; i < n; i++) {
      const f = displayFrames[i];
      if (native.width !== f.width || native.height !== f.height) {
        native.width = f.width;
        native.height = f.height;
      }
      const nctx = native.getContext("2d")!;
      nctx.putImageData(frameToImageData(f, displayMin, displayMax), 0, 0);
      const x = GAP + i * step;
      ctx.drawImage(native, x, LABEL_H, thumbW, THUMB_H);
      // frame index label
      ctx.fillStyle = "#9aa7b4";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(String(i), x + 2, 10);
    }
    cacheRef.current = cache;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, first?.width, first?.height, displayMin, displayMax, showRaw, aligned]);

  const redraw = () => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    if (!canvas || !cache) return;
    if (canvas.width !== contentW) canvas.width = contentW;
    if (canvas.height !== canvasH) canvas.height = canvasH;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, contentW, canvasH);
    ctx.drawImage(cache, 0, 0);

    // bleach-frame tick
    if (bleachFrame >= 0 && bleachFrame < n) {
      const x = GAP + bleachFrame * step;
      ctx.fillStyle = "#ff5d5d";
      ctx.fillRect(x, LABEL_H - 3, thumbW, 3);
    }
    // current-frame highlight
    if (currentFrame >= 0 && currentFrame < n) {
      const x = GAP + currentFrame * step;
      ctx.strokeStyle = "#4aa3ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, LABEL_H - 1, thumbW + 2, THUMB_H + 2);
    }
  };

  // Redraw overlays + keep the current thumbnail in view when stepping.
  useEffect(() => {
    redraw();
    const sc = scrollRef.current;
    if (sc && n > 0) {
      const x = GAP + currentFrame * step;
      if (x < sc.scrollLeft) sc.scrollLeft = x - GAP;
      else if (x + thumbW > sc.scrollLeft + sc.clientWidth)
        sc.scrollLeft = x + thumbW - sc.clientWidth + GAP;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame, bleachFrame, n, open]);

  const onClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.floor((x - GAP) / step);
    if (idx >= 0 && idx < n) setCurrentFrame(idx);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <div className="section-bar">
        <b>🎞 Frame timeline</b>
        {n > 0 ? (
          <span>
            click any frame to view it · frame {currentFrame + 1} / {n}
          </span>
        ) : (
          <span>load a stack (or the demo) to see every frame here</span>
        )}
        <div className="spacer" />
        {n > 0 && (
          <button onClick={() => setOpen((o) => !o)}>
            {open ? "▼ Minimize" : "▲ Expand"}
          </button>
        )}
      </div>
      {n > 0 && open && (
        <div
          ref={scrollRef}
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <canvas
            ref={canvasRef}
            onClick={onClick}
            style={{ display: "block", height: canvasH, cursor: "pointer" }}
          />
        </div>
      )}
    </div>
  );
}
