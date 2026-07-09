import { useFrapStore } from "../store/useFrapStore";

export default function BleachPanel() {
  const bleachFrame = useFrapStore((s) => s.bleachFrame);
  const setBleachFrame = useFrapStore((s) => s.setBleachFrame);
  const autoDetect = useFrapStore((s) => s.autoDetectBleach);
  const currentFrame = useFrapStore((s) => s.currentFrame);
  const n = useFrapStore((s) => (s.aligned ?? s.frames).length);

  return (
    <div className="panel">
      <h2>5 · Bleach frame</h2>
      <small className="note">
        The first post-bleach frame. Frames before it are averaged as the
        pre-bleach baseline.
      </small>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Bleach frame</label>
        <input
          type="number"
          min={0}
          max={Math.max(0, n - 1)}
          value={bleachFrame}
          onChange={(e) => setBleachFrame(Number(e.target.value) || 0)}
        />
        <span style={{ color: "var(--muted)" }}>{bleachFrame} pre-bleach</span>
      </div>
      <div className="btn-row">
        <button onClick={autoDetect}>Auto-detect</button>
        <button onClick={() => setBleachFrame(currentFrame)}>
          Use current ({currentFrame})
        </button>
      </div>
    </div>
  );
}
