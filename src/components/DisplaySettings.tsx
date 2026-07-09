import { useFrapStore } from "../store/useFrapStore";

export default function DisplaySettings() {
  const displayMin = useFrapStore((s) => s.displayMin);
  const displayMax = useFrapStore((s) => s.displayMax);
  const displayCeiling = useFrapStore((s) => s.displayCeiling);
  const setDisplay = useFrapStore((s) => s.setDisplay);

  return (
    <div className="panel">
      <h2>Display (brightness / contrast)</h2>
      <small className="note">
        Adjusts only how the image looks — measurements always use the original
        pixel values.
      </small>
      <div className="row" style={{ marginTop: 8 }}>
        <label style={{ width: 34 }}>Min</label>
        <input
          type="range"
          min={0}
          max={displayCeiling}
          value={displayMin}
          onChange={(e) =>
            setDisplay(Math.min(Number(e.target.value), displayMax - 1), displayMax)
          }
        />
        <span style={{ width: 44, textAlign: "right" }}>{displayMin}</span>
      </div>
      <div className="row">
        <label style={{ width: 34 }}>Max</label>
        <input
          type="range"
          min={0}
          max={displayCeiling}
          value={displayMax}
          onChange={(e) =>
            setDisplay(displayMin, Math.max(Number(e.target.value), displayMin + 1))
          }
        />
        <span style={{ width: 44, textAlign: "right" }}>{displayMax}</span>
      </div>
      <div className="btn-row">
        <button onClick={() => setDisplay(0, displayCeiling)}>Reset</button>
      </div>
    </div>
  );
}
