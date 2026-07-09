import { useRef, useState } from "react";
import { useFrapStore } from "../store/useFrapStore";
import { loadTiffFiles } from "../lib/tiff";

export default function ImportPanel() {
  const sources = useFrapStore((s) => s.sources);
  const addSources = useFrapStore((s) => s.addSources);
  const removeSource = useFrapStore((s) => s.removeSource);
  const sortSources = useFrapStore((s) => s.sortSources);
  const concatenate = useFrapStore((s) => s.concatenate);
  const loadDemo = useFrapStore((s) => s.loadDemo);
  const reset = useFrapStore((s) => s.reset);
  const frames = useFrapStore((s) => s.frames);

  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const loaded = await loadTiffFiles(Array.from(files));
      addSources(loaded);
    } catch (e) {
      alert("Failed to read TIFF: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalFrames = sources.reduce((a, s) => a + s.frames.length, 0);

  return (
    <div className="panel">
      <h2>1 · Load &amp; Concatenate</h2>
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {loading ? "Decoding…" : "Drop TIFF stack(s) here, or click to browse"}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".tif,.tiff,image/tiff"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {sources.length > 0 && (
        <>
          <ul className="file-list" style={{ marginTop: 8 }}>
            {sources.map((s, i) => (
              <li key={i}>
                <span className="name">{s.name}</span>
                <span style={{ color: "var(--muted)" }}>{s.frames.length}f</span>
                <button onClick={() => removeSource(i)}>✕</button>
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <button onClick={sortSources}>Sort by name</button>
            <button className="primary" onClick={concatenate}>
              Concatenate ({totalFrames}f)
            </button>
          </div>
          <small className="note">
            Files concatenate top-to-bottom. Use “Sort by name” for natural
            chronological order (e.g. t1, t2, …, t10).
          </small>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button onClick={loadDemo}>Load demo dataset</button>
        <button onClick={reset}>Reset</button>
      </div>
      {frames.length > 0 && (
        <small className="note">Active stack: {frames.length} frames.</small>
      )}
    </div>
  );
}
