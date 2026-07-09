import { useEffect, useRef, useState } from "react";
import { useFrapStore } from "../store/useFrapStore";

export default function FrameControls() {
  const currentFrame = useFrapStore((s) => s.currentFrame);
  const setCurrentFrame = useFrapStore((s) => s.setCurrentFrame);
  const bleachFrame = useFrapStore((s) => s.bleachFrame);
  const n = useFrapStore((s) => (s.aligned ?? s.frames).length);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || n === 0) return;
    timer.current = window.setInterval(() => {
      const next = (useFrapStore.getState().currentFrame + 1) % n;
      useFrapStore.getState().setCurrentFrame(next);
    }, 120);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, n]);

  if (n === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderTop: "1px solid var(--border)",
        background: "var(--panel)",
        flexShrink: 0,
      }}
    >
      <button onClick={() => setPlaying((p) => !p)}>
        {playing ? "❚❚" : "►"}
      </button>
      <button onClick={() => setCurrentFrame(currentFrame - 1)}>‹</button>
      <input
        type="range"
        min={0}
        max={n - 1}
        value={currentFrame}
        onChange={(e) => setCurrentFrame(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <button onClick={() => setCurrentFrame(currentFrame + 1)}>›</button>
      <span style={{ minWidth: 90, textAlign: "right", fontSize: 12 }}>
        {currentFrame + 1} / {n}
        {currentFrame === bleachFrame ? " · bleach" : ""}
      </span>
    </div>
  );
}
