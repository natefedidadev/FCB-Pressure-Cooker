import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./components/HomePage";
import MatchSelectionPage from "./components/MatchSelectionPage";
import AnalysisDashboard from "./components/AnalysisDashboard";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/matches" element={<MatchSelectionPage />} />
        <Route path="/analysis/:matchIndex" element={<AnalysisDashboard />} />
      </Routes>
    </Layout>
  );
}

export default App;
