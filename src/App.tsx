import ImageViewer from "./components/ImageViewer";
import FrameControls from "./components/FrameControls";
import Timeline from "./components/Timeline";
import DisplaySettings from "./components/DisplaySettings";
import ImportPanel from "./components/ImportPanel";
import AlignPanel from "./components/AlignPanel";
import CalibrationPanel from "./components/CalibrationPanel";
import RoiPanel from "./components/RoiPanel";
import BleachPanel from "./components/BleachPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import RecoveryChart from "./components/RecoveryChart";
import DataTable from "./components/DataTable";
import { useFrapStore } from "./store/useFrapStore";
import { useState } from "react";

export default function App() {
  const status = useFrapStore((s) => s.status);
  const [bottomOpen, setBottomOpen] = useState(true);

  return (
    <div className="app">
      <header className="topbar">
        <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt="FRAP Analyzer logo"
            width={28}
            height={28}
          />
          FRAP Analyzer
        </h1>
        <div className="steps">
          <span>
            <b>1</b> Load
          </span>
          <span>→</span>
          <span>
            <b>2</b> Align
          </span>
          <span>→</span>
          <span>
            <b>3</b> Calibrate
          </span>
          <span>→</span>
          <span>
            <b>4</b> ROIs
          </span>
          <span>→</span>
          <span>
            <b>5</b> Bleach frame
          </span>
          <span>→</span>
          <span>
            <b>6</b> Analyze
          </span>
        </div>
        <div className="spacer" />
        {status && <div className="status">{status}</div>}
      </header>

      <div className="main">
        <div className="viewer-col">
          <ImageViewer />
          <FrameControls />
          <Timeline />
        </div>
        <div className="panels">
          <ImportPanel />
          <AlignPanel />
          <DisplaySettings />
          <CalibrationPanel />
          <RoiPanel />
          <BleachPanel />
          <AnalysisPanel />
        </div>
      </div>

      <div className="bottom-wrap">
        <div className="section-bar">
          <b>📊 Results</b>
          <span>recovery curve &amp; measurements</span>
          <div className="spacer" />
          <button onClick={() => setBottomOpen((o) => !o)}>
            {bottomOpen ? "▼ Minimize" : "▲ Expand"}
          </button>
        </div>
        {bottomOpen && (
          <div className="bottom">
            <RecoveryChart />
            <DataTable />
          </div>
        )}
      </div>
    </div>
  );
}
