import { Link, useLocation } from "react-router-dom";
import fcbLogo from "../assets/FC_Barcelona_(crest).svg.png";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/matches", label: "Matches" },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1900px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img src={fcbLogo} alt="FC Barcelona" className="h-9 w-9" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-white">Pressure</span>
              <span className="text-barca-gold"> Cooker</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors no-underline
                    ${isActive
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
