import { useState, useEffect } from "react";
import { fetchMatches, fetchRisk, fetchDangers } from "./api";
import MatchSelector from "./components/MatchSelector";
import RiskTimeline from "./components/RiskTimeline";
import DangerPanel from "./components/DangerPanel";
import DangerList from "./components/DangerList";
import WindowAnalysis from "./components/WindowAnalysis";

function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [dangersData, setDangersData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDanger, setSelectedDanger] = useState(null);
  const [windowStart, setWindowStart] = useState(null);
  const [windowEnd, setWindowEnd] = useState(null);

  // Load match list on mount
  useEffect(() => {
    fetchMatches().then(setMatches).catch(console.error);
  }, []);

  // Load data when match changes
  useEffect(() => {
    if (selectedMatch === null) return;
    setLoading(true);
    setSelectedDanger(null);
    setWindowStart(null);
    setWindowEnd(null);
    setRiskData(null);
    setDangersData(null);

    Promise.all([fetchRisk(selectedMatch), fetchDangers(selectedMatch)])
      .then(([risk, dangers]) => {
        setRiskData(risk);
        setDangersData(dangers);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedMatch]);

  const handleChartClick = (point) => {
    if (!windowStart) {
      setWindowStart(point);
      setWindowEnd(null);
    } else if (!windowEnd) {
      setWindowEnd(point);
    } else {
      // Reset: start new selection
      setWindowStart(point);
      setWindowEnd(null);
    }
  };

  const handleClearWindow = () => {
    setWindowStart(null);
    setWindowEnd(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              <span className="text-barca-maroon">FCB</span> Defensive Risk Analysis
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Fault Lines — Defensive Early Warning System</p>
          </div>
          <div className="w-96">
            <MatchSelector
              matches={matches}
              selected={selectedMatch}
              onSelect={setSelectedMatch}
              loading={loading}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {!selectedMatch && selectedMatch !== 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg">Select a match to begin analysis</p>
          </div>
        )}

        {loading && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg">Loading match data...</p>
          </div>
        )}

        {riskData && dangersData && !loading && (
          <div className="space-y-4">
            {/* Match info */}
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-white font-medium">{riskData.match_name}</span>
              <span>vs</span>
              <span className="text-white font-medium">{dangersData.opponent}</span>
            </div>

            {/* Chart + Danger list layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <RiskTimeline
                  timeline={riskData.timeline}
                  dangers={dangersData.dangers}
                  onDangerClick={setSelectedDanger}
                  windowStart={windowStart}
                  windowEnd={windowEnd}
                  onChartClick={handleChartClick}
                />
              </div>
              <div>
                <DangerList
                  dangers={dangersData.dangers}
                  selectedDanger={selectedDanger}
                  onSelect={setSelectedDanger}
                />
              </div>
            </div>

            {/* Window analysis */}
            <WindowAnalysis
              matchIndex={selectedMatch}
              windowStart={windowStart}
              windowEnd={windowEnd}
              onClear={handleClearWindow}
            />

            {/* Danger detail panel */}
            <DangerPanel
              danger={selectedDanger}
              onClose={() => setSelectedDanger(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
