import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import fcbLogo from "../assets/FC_Barcelona_(crest).svg.png";

const DESCRIPTION_WORDS =
  "A defensive risk early warning system that identifies when and why FC Barcelona is most vulnerable during a match — powered by event data, risk modeling, and AI-driven tactical analysis.".split(" ");

function TypewriterText() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= DESCRIPTION_WORDS.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), 60);
    return () => clearTimeout(id);
  }, [count]);

  return (
    <p className="mt-6 text-xl text-white/50 max-w-3xl mx-auto leading-relaxed font-light">
      {DESCRIPTION_WORDS.slice(0, count).map((word, i) => (
        <span
          key={i}
          className="inline-block mr-[0.3em] animate-[fadeIn_0.3s_ease]"
        >
          {word}
        </span>
      ))}
      {count < DESCRIPTION_WORDS.length && (
        <span className="inline-block w-0.5 h-5 bg-barca-gold/70 align-middle animate-pulse ml-0.5" />
      )}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="text-center px-6 -mt-16">
        <img src={fcbLogo} alt="FC Barcelona" className="h-36 w-36 mx-auto mb-10 drop-shadow-2xl" />
        <h1 className="text-7xl font-extrabold tracking-tight leading-none">
          <span className="text-white">FCB </span>
          <span className="text-barca-maroon">Pressure </span>
          <span className="text-barca-blue">Cooker</span>
        </h1>
        <TypewriterText />
        <Link
          to="/matches"
          className="mt-12 inline-flex items-center gap-2 bg-barca-maroon text-white font-bold px-10 py-4 rounded-full text-lg
                     hover:brightness-125 transition shadow-lg shadow-barca-maroon/30 no-underline"
        >
          Explore Matches
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {/* Ambient glow — radial gradients for clean edges */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 60% at 10% 10%, rgba(165,0,68,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 60% at 90% 90%, rgba(0,77,152,0.10) 0%, transparent 70%)
          `,
        }}
      />
    </div>
  );
}
