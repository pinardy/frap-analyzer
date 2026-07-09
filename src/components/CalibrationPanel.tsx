import { useState } from "react";
import { useFrapStore } from "../store/useFrapStore";
import { lineLengthPx } from "../lib/calibration";

export default function CalibrationPanel() {
  const activeTool = useFrapStore((s) => s.activeTool);
  const setActiveTool = useFrapStore((s) => s.setActiveTool);
  const calibration = useFrapStore((s) => s.calibration);
  const setScaleLine = useFrapStore((s) => s.setScaleLine);
  const clearScaleLine = useFrapStore((s) => s.clearScaleLine);
  const setCalibration = useFrapStore((s) => s.setCalibration);

  const [lengthUm, setLengthUm] = useState(
    calibration.scaleLengthUm?.toString() ?? "10",
  );
  const [manualScale, setManualScale] = useState(
    calibration.umPerPixel > 0 ? (1 / calibration.umPerPixel).toString() : "",
  );

  const line = calibration.scaleLine;
  const px = line ? lineLengthPx(line.x1, line.y1, line.x2, line.y2) : 0;

  const apply = () => {
    if (!line) return;
    const um = Number(lengthUm);
    if (!(um > 0)) return;
    setScaleLine(line, um);
  };

  const applyManual = () => {
    const v = Number(manualScale); // pixels per µm
    if (v > 0) setCalibration({ umPerPixel: 1 / v });
  };

  const pixelsPerUm = calibration.umPerPixel > 0 ? 1 / calibration.umPerPixel : 0;

  return (
    <div className="panel">
      <h2>3 · Calibrate</h2>
      <div className="btn-row">
        <button
          className={activeTool === "scale" ? "active" : ""}
          onClick={() =>
            setActiveTool(activeTool === "scale" ? "none" : "scale")
          }
        >
          {activeTool === "scale" ? "Drawing scale…" : "Draw scale line"}
        </button>
        <button onClick={clearScaleLine} disabled={!line}>
          Undo line
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Line length</label>
        <span>{line ? `${px.toFixed(1)} px` : "no line drawn"}</span>
      </div>
      <div className="row">
        <label>Known length</label>
        <input
          type="number"
          value={lengthUm}
          onChange={(e) => setLengthUm(e.target.value)}
        />
        <span>µm</span>
        <button onClick={apply} disabled={!line}>
          Apply
        </button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <label>Or set directly</label>
        <input
          type="number"
          step="0.1"
          min={0}
          value={manualScale}
          onChange={(e) => setManualScale(e.target.value)}
        />
        <span>px/µm</span>
        <button onClick={applyManual}>Set</button>
      </div>
      <div className="row">
        <label>Scale</label>
        <b>
          {pixelsPerUm > 0 ? `${pixelsPerUm.toFixed(3)} px/µm` : "not set"}
        </b>
      </div>
      {pixelsPerUm > 0 && (
        <small className="note" style={{ marginTop: 0 }}>
          = {calibration.umPerPixel.toFixed(4)} µm/px
        </small>
      )}
      <div className="row">
        <label>Frame interval</label>
        <input
          type="number"
          step="0.1"
          value={calibration.secondsPerFrame}
          onChange={(e) =>
            setCalibration({ secondsPerFrame: Number(e.target.value) || 0 })
          }
        />
        <span>s/frame</span>
      </div>
    </div>
  );
}
