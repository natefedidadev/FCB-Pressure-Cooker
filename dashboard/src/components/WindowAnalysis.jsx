import { useState } from "react";
import { analyzeWindow } from "../api";

function fmtMin(minute) {
  const m = Math.floor(minute);
  const s = Math.round((minute % 1) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WindowAnalysis({ matchIndex, windowStart, windowEnd, onClear }) {
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  if (!windowStart || !windowEnd) return null;

  const startSec = Math.min(windowStart.time_sec, windowEnd.time_sec);
  const endSec = Math.max(windowStart.time_sec, windowEnd.time_sec);
  const startMin = Math.min(windowStart.match_minute, windowEnd.match_minute);
  const endMin = Math.max(windowStart.match_minute, windowEnd.match_minute);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeWindow(matchIndex, startSec, endSec);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
    onClear();
  };

  return (
    <div className="bg-surface rounded-2xl p-5 border border-barca-blue/20 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-muted text-sm">
          Window: <span className="font-medium text-white">{fmtMin(startMin)} - {fmtMin(endMin)}</span>
        </span>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="bg-barca-blue text-white px-4 py-1.5 rounded-full text-sm font-medium
                     hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed transition
                     shadow-[0_0_15px_rgba(0,77,152,0.3)]"
        >
          {analyzing ? "Analyzing..." : "Analyze Window"}
        </button>
        <button
          onClick={handleClear}
          className="text-muted hover:text-white text-sm transition-colors"
        >
          Clear
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm">{error}</p>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex gap-4 text-sm text-muted mb-2">
            <span>Avg risk: <span className="font-medium text-white">{result.avg_risk}</span></span>
            <span>Events: <span className="font-medium text-white">{result.event_count}</span></span>
          </div>
          <div className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm">
            {result.explanation}
          </div>
        </div>
      )}
    </div>
  );
}
