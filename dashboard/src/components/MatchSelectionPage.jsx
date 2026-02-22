import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMatches } from "../api";

import arsenalLogo from "../assets/Arsenal_FC.svg.png";
import comoLogo from "../assets/Calcio_Como_-_logo_(Italy,_2019-).svg.png";
import daeguLogo from "../assets/Daegu_FC.svg.png";
import fcbLogo from "../assets/FC_Barcelona_(crest).svg.png";
import seoulLogo from "../assets/FC_Seoul_logo.svg.png";
import milanLogo from "../assets/Logo_of_AC_Milan.svg.png";
import monacoLogo from "../assets/LogoASMonacoFC2021.svg.png";
import manCityLogo from "../assets/Manchester_City_FC_badge.svg.png";
import realMadridLogo from "../assets/Real_Madrid_CF.svg.png";
import visselLogo from "../assets/Vissel_Kobe_logo.svg.png";

const TEAM_LOGO_RULES = [
  { keywords: ["barça", "barcelona"], logo: fcbLogo },
  { keywords: ["arsenal"], logo: arsenalLogo },
  { keywords: ["como"], logo: comoLogo },
  { keywords: ["daegu"], logo: daeguLogo },
  { keywords: ["seül", "seoul", "seul"], logo: seoulLogo },
  { keywords: ["milan"], logo: milanLogo },
  { keywords: ["mònaco", "monaco"], logo: monacoLogo },
  { keywords: ["manchester city", "man city"], logo: manCityLogo },
  { keywords: ["reial madrid", "real madrid"], logo: realMadridLogo },
  { keywords: ["vissel", "kobe"], logo: visselLogo },
];

function getTeamLogo(teamName) {
  if (!teamName) return null;
  const lower = teamName.toLowerCase();
  for (const rule of TEAM_LOGO_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.logo;
  }
  return null;
}

function TeamLogo({ name, size = "h-10 w-10" }) {
  const logo = getTeamLogo(name);
  if (logo) {
    return <img src={logo} alt={name} className={`${size} object-contain`} />;
  }
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()
    : "?";
  return (
    <div className={`${size} rounded-full bg-white/10 flex items-center justify-center text-white/70 font-bold text-xs`}>
      {initials}
    </div>
  );
}

const TEAM_NAME_MAP = {
  "barça": "Barça",
  "reial madrid": "Real Madrid",
  "fc seül": "FC Seoul",
  "as mònaco": "AS Monaco",
  "como 1907": "Como 1907",
};

const COMP_NAME_MAP = {
  "partit amistós gira": "Friendly Tour",
  "trofeu joan gamper": "Joan Gamper Trophy",
  "partit amistós gira pretemporada": "Pre-Season Friendly Tour",
};

function englishName(name) {
  const lower = name.toLowerCase();
  for (const [catalan, english] of Object.entries(TEAM_NAME_MAP)) {
    if (lower === catalan) return english;
  }
  return name;
}

function englishComp(comp) {
  if (!comp) return "";
  for (const [catalan, english] of Object.entries(COMP_NAME_MAP)) {
    if (comp.toLowerCase().startsWith(catalan)) {
      const year = comp.replace(/^[^\d]*/i, "").trim();
      return year ? `${english} ${year}` : english;
    }
  }
  return comp;
}

function parseMatchTeams(matchName) {
  const pattern = /^(.+?)\s*-\s*(.+?)\s*\(([^)]+)\)\s*(.*)$/;
  const match = matchName.match(pattern);
  if (match) {
    return {
      home: englishName(match[1].trim()),
      away: englishName(match[2].trim()),
      score: match[3].split("_")[0].trim(),
      competition: englishComp(match[4].trim()),
    };
  }
  return { home: matchName, away: "", score: "", competition: "" };
}

export default function MatchSelectionPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!matches.length || loading) return;
    if (visibleCount >= matches.length) return;
    const id = setTimeout(() => setVisibleCount((c) => c + 1), 80);
    return () => clearTimeout(id);
  }, [visibleCount, matches, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
        <p className="text-muted text-lg">Loading matches...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1900px] mx-auto px-6 flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="pt-6 pb-4 text-center shrink-0">
        <h1 className="text-4xl font-bold text-white">Match Selection</h1>
        <p className="text-muted mt-2 text-base">Choose a match to analyze its defensive risk profile</p>
      </div>

      <div className="flex flex-wrap justify-center gap-7 flex-1 content-start pb-6">
        {matches.slice(0, visibleCount).map((m) => {
          const { home, away, score, competition } = parseMatchTeams(m.name);
          return (
            <button
              key={m.index}
              onClick={() => navigate(`/analysis/${m.index}`)}
              className="bg-surface rounded-2xl px-8 py-10 group cursor-pointer
                         animate-[fadeIn_0.3s_ease]
                         border border-white/5
                         shadow-[0_4px_30px_rgba(0,0,0,0.3)]
                         hover:shadow-[0_4px_40px_rgba(0,77,152,0.2)]
                         hover:border-barca-blue/30 hover:scale-[1.02]
                         transition-all duration-75
                         w-[calc(33.333%-1.25rem)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <TeamLogo name={home} size="h-16 w-16" />
                  <div className="min-w-0">
                    <p className="font-semibold text-lg text-white truncate">{home}</p>
                    <p className="text-muted text-xs mt-1">Home</p>
                  </div>
                </div>

                <div className="text-center shrink-0">
                  <span className="font-bold text-4xl text-white">{score}</span>
                </div>

                <div className="flex items-center gap-3 min-w-0 flex-row-reverse">
                  <TeamLogo name={away} size="h-16 w-16" />
                  <div className="min-w-0 text-right">
                    <p className="font-semibold text-lg text-white truncate">{away}</p>
                    <p className="text-muted text-xs mt-1">Away</p>
                  </div>
                </div>
              </div>

              {competition && (
                <p className="mt-5 text-sm text-muted text-center truncate">{competition}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
