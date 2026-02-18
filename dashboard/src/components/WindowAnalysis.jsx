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
    <div className="bg-gray-800 rounded-xl p-4 border border-barca-blue/50 mt-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-gray-300 text-sm">
          Selected window: <span className="text-white font-medium">{fmtMin(startMin)} - {fmtMin(endMin)}</span>
        </span>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="bg-barca-blue text-white px-4 py-1.5 rounded-lg text-sm font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? "Analyzing..." : "Analyze Window"}
        </button>
        <button
          onClick={handleClear}
          className="text-gray-500 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm">{error}</p>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex gap-4 text-sm text-gray-400 mb-2">
            <span>Avg risk: <span className="text-white">{result.avg_risk}</span></span>
            <span>Events: <span className="text-white">{result.event_count}</span></span>
          </div>
          <div className="text-gray-100 leading-relaxed whitespace-pre-wrap text-sm">
            {result.explanation}
          </div>
        </div>
      )}
    </div>
  );
}
