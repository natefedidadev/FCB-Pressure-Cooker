"""
pattern_analyzer.py

Phase 3: Cross-match pattern detection

Pipeline:
  matches -> events_df -> risk_df -> danger moments -> fingerprint_seq -> cluster -> stats + confidence

Key outputs per pattern:
  - sequence (list[str])
  - match_count + frequency
  - occurrences, goals_in_pattern
  - pattern_goal_rate, baseline_goal_rate, lift
  - avg_time_to_goal (seconds, optional)
  - Bayesian confidence fields (posterior mean, CI, P(p>baseline), confidence_score, tier)
  - example_matches + a few example danger moments (for traceability)

Notes:
  - Fingerprints are heuristic (NOT ML).
  - Clustering uses subsequence similarity (order preserved, not necessarily contiguous).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import math
import numpy as np
import pandas as pd
from scipy.stats import beta  # scipy already in project from danger_detector

from data_loader import list_matches, load_events
from risk_engine import compute_risk_score, OPPONENT_WEIGHTS, BARCA_WEIGHTS
from danger_detector import detect_danger_moments


# ----------------------------
# Config
# ----------------------------

DEFAULT_FINGERPRINT_WINDOW_SEC = 60

# Stopwords for cross-match PATTERNING (not Phase 2 diagnostics)
DEFAULT_STOPWORDS = {
    "BUILD UP",
    "GOALS",
    "SET PIECES",
    "PLAYERS IN THE BOX",
    "BALL IN FINAL THIRD",
    "BALL IN THE BOX",
}

# Keep fingerprints short + interpretable
DEFAULT_TOP_K_CODES = 4

# Pattern grouping defaults
DEFAULT_MIN_SUBSEQ_SIMILARITY = 0.85
DEFAULT_MIN_MATCH_FREQUENCY = 2

# Optional: keep patterns from being trivial (you can enforce this in find_patterns if you want)
MIN_PATTERN_LEN = 2

# Confidence tier thresholds (coach-facing)
CONF_TIER_HIGH = 0.70
CONF_TIER_MED = 0.45

CAUSE_CODES = {
    "ATTACKING TRANSITION",
    "DEFENSIVE TRANSITION",
    "PROGRESSION",
    "CREATING CHANCES",
}

REQUIRE_CAUSE_CODE = True

# ----------------------------
# Helpers: fingerprint building
# ----------------------------

def _has_cause_code(seq: List[str]) -> bool:
    return any(c in CAUSE_CODES for c in (seq or []))

def _normalize_active_events_to_codes(active_events: Any) -> List[str]:
    """
    Accepts:
      - list[str]
      - list[dict] where dict may contain 'code'
      - str
      - None / NaN
    Returns list[str] codes.
    """
    if active_events is None:
        return []
    try:
        if isinstance(active_events, float) and np.isnan(active_events):
            return []
    except Exception:
        pass

    if isinstance(active_events, list):
        if not active_events:
            return []
        if isinstance(active_events[0], str):
            return [str(x) for x in active_events]
        if isinstance(active_events[0], dict):
            out: List[str] = []
            for e in active_events:
                if isinstance(e, dict) and e.get("code"):
                    out.append(str(e["code"]))
            return out
        return [str(x) for x in active_events]

    if isinstance(active_events, str):
        return [active_events]

    return []


def _dedupe_preserve_order(seq: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _code_weight(code: str) -> float:
    """Heuristic importance weight used only for fingerprint compression."""
    return float(max(OPPONENT_WEIGHTS.get(code, 0), BARCA_WEIGHTS.get(code, 0)))


def _compress_sequence_keep_order(seq: List[str], top_k: int = DEFAULT_TOP_K_CODES) -> List[str]:
    """
    Keep only the top_k highest-weight codes that appear in the sequence,
    but preserve original order.
    """
    if not seq:
        return []
    unique = _dedupe_preserve_order(seq)
    scored = [(c, _code_weight(c)) for c in unique]
    scored.sort(key=lambda x: x[1], reverse=True)
    keep = {c for c, _w in scored[:top_k]}
    return [c for c in unique if c in keep]


def build_fingerprint_sequence(
    risk_df: pd.DataFrame,
    peak_time_sec: int,
    window_sec: int = DEFAULT_FINGERPRINT_WINDOW_SEC,
    *,
    stopwords: Optional[set[str]] = None,
    top_k: int = DEFAULT_TOP_K_CODES,
) -> List[str]:
    """
    Fingerprint = codes that ENTER the active set over the last `window_sec`,
    filtered by stopwords, then compressed to top_k by weight.

    We dedupe + keep order to preserve the tactical story.
    """
    if stopwords is None:
        stopwords = DEFAULT_STOPWORDS

    if risk_df is None or len(risk_df) == 0:
        return []
    if "timestamp_sec" not in risk_df.columns or "active_events" not in risk_df.columns:
        return []

    t0 = max(int(peak_time_sec) - int(window_sec), int(risk_df["timestamp_sec"].min()))
    t1 = int(peak_time_sec)

    window = risk_df[(risk_df["timestamp_sec"] >= t0) & (risk_df["timestamp_sec"] <= t1)].copy()

    seq: List[str] = []
    prev_set: set[str] = set()

    for _, row in window.iterrows():
        codes = _normalize_active_events_to_codes(row.get("active_events"))
        cur_set = {c for c in codes if c and c not in stopwords}

        # add only codes that newly appear at this second
        entered = [c for c in codes if (c in cur_set and c not in prev_set)]
        seq.extend(entered)

        prev_set = cur_set

    seq = _dedupe_preserve_order(seq)
    seq = _compress_sequence_keep_order(seq, top_k=top_k)
    return seq


# ----------------------------
# Helpers: sequence similarity
# ----------------------------

def _is_subsequence(shorter: List[str], longer: List[str]) -> bool:
    """True if `shorter` is a subsequence of `longer` (order preserved, not necessarily contiguous)."""
    if not shorter:
        return True
    it = iter(longer)
    return all(any(x == y for y in it) for x in shorter)


def subseq_similarity(a: List[str], b: List[str]) -> float:
    """
    Simple similarity based on subsequence overlap.
    Returns value in [0,1].
    """
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0

    if len(a) <= len(b):
        overlap = len(a) if _is_subsequence(a, b) else 0
        return overlap / max(len(a), len(b))
    else:
        overlap = len(b) if _is_subsequence(b, a) else 0
        return overlap / max(len(a), len(b))


# ----------------------------
# Helpers: goal time enrichment
# ----------------------------

def _get_opponent_goal_times(events_df: pd.DataFrame) -> List[int]:
    """
    Return sorted list of opponent GOALS timestamps (seconds).
    Tries to find a start-time column from common names.
    """
    if events_df is None or len(events_df) == 0:
        return []

    # Find a usable start-time column
    start_col = None
    for c in ["start_sec", "start", "Start", "start_time", "StartTime"]:
        if c in events_df.columns:
            start_col = c
            break
    if start_col is None:
        return []

    if "code" not in events_df.columns or "Team" not in events_df.columns:
        return []

    goals = events_df[events_df["code"] == "GOALS"].copy()

    # Opponent goals only (not Barça goals)
    goals = goals[goals["Team"].astype(str).str.lower() != "barça"]

    times: List[int] = []
    for v in goals[start_col].tolist():
        try:
            times.append(int(v))
        except Exception:
            pass

    return sorted(times)


def _next_goal_delta_sec(
    peak_time: int,
    opponent_goal_times: List[int],
    max_lookahead: int = 120,
) -> Optional[int]:
    """
    Returns seconds until next opponent goal after peak_time, if within max_lookahead.
    Else returns None.
    """
    if not opponent_goal_times:
        return None
    for gt in opponent_goal_times:
        if gt >= peak_time:
            delta = gt - peak_time
            return int(delta) if delta <= max_lookahead else None
    return None


# ----------------------------
# Build danger moments for patterning
# ----------------------------

def build_all_matches_dangers_for_patterns(
    matches: List[str],
    *,
    mode: str = "all",  # "all" | "goals" | "critical"
    peak_percentile: float = 70,
    threshold_floor: float = 40.0,
    min_distance: int = 35,
    prominence: float = 10.0,
    goal_lookback: int = 90,
    merge_within_sec: int = 60,
    time_to_goal_lookahead_sec: int = 120,
) -> List[Dict[str, Any]]:
    """
    For each match:
      events_df -> risk_df -> danger moments -> (optional filter) -> fingerprint + time_to_goal_sec

    Returns a flat list of danger dicts, each augmented with:
      - match_name
      - fingerprint_seq
      - time_to_goal_sec (Optional[int])
    """
    all_dangers: List[Dict[str, Any]] = []

    mode = (mode or "all").lower().strip()
    if mode not in {"all", "goals", "critical"}:
        raise ValueError("mode must be one of: 'all', 'goals', 'critical'")

    for match_name in matches:
        events_df = load_events(match_name)
        risk_df = compute_risk_score(events_df)

        dangers = detect_danger_moments(
            risk_df,
            events_df,
            peak_percentile=peak_percentile,
            threshold_floor=threshold_floor,
            min_distance=min_distance,
            prominence=prominence,
            goal_lookback=goal_lookback,
            merge_within_sec=merge_within_sec,
        )

        # Filter BEFORE fingerprinting
        if mode == "goals":
            dangers = [d for d in dangers if bool(d.get("resulted_in_goal", False))]
        elif mode == "critical":
            dangers = [d for d in dangers if str(d.get("severity", "")).lower() == "critical"]

        opp_goal_times = _get_opponent_goal_times(events_df)

        for d in dangers:
            peak_time = int(d["peak_time"])

            seq = build_fingerprint_sequence(
                risk_df,
                peak_time_sec=peak_time,
                window_sec=DEFAULT_FINGERPRINT_WINDOW_SEC,
                stopwords=DEFAULT_STOPWORDS,
                top_k=DEFAULT_TOP_K_CODES,
            )

            time_to_goal = _next_goal_delta_sec(
                peak_time,
                opp_goal_times,
                max_lookahead=time_to_goal_lookahead_sec,
            )

            dd = dict(d)
            dd["match_name"] = match_name
            dd["fingerprint_seq"] = seq
            dd["time_to_goal_sec"] = time_to_goal
            all_dangers.append(dd)

    return all_dangers


# ----------------------------
# Pattern grouping
# ----------------------------

@dataclass
class Pattern:
    sequence: List[str]
    matches: set[str]
    examples: List[Dict[str, Any]]
    goals_in_pattern: int


def find_patterns(
    all_dangers: List[Dict[str, Any]],
    *,
    baseline_dangers: Optional[List[Dict[str, Any]]] = None,
    min_subseq_similarity: float = DEFAULT_MIN_SUBSEQ_SIMILARITY,
    min_match_frequency: int = DEFAULT_MIN_MATCH_FREQUENCY,
    min_occurrences: int = 3,
    min_lift: float = 1.15,
    # Confidence tuning knobs
    ci_level: float = 0.90,                 # 90% credible interval
    support_target_occ: int = 25,           # how many occurrences until "fully supported"
    support_target_matches: int = 6,        # how many matches until "fully supported"
) -> List[Dict[str, Any]]:
    """
    Cluster sequences into patterns and compute confidence.

    Baseline:
      - baseline_dangers should be ALL danger moments (mode="all") for stable baseline.
      - if not provided, baseline is computed from all_dangers (less ideal).

    Confidence is Bayesian:
      - model: goal ~ Bernoulli(p)
      - prior: Beta(1,1)
      - posterior: Beta(k+1, n-k+1)
    Then compute:
      - P(p > baseline_goal_rate)
      - credible interval for p
      - composite confidence_score = P(p > baseline) * support_scaler
    """

    # ----------------------------
    # Compute baseline goal rate
    # ----------------------------
    base = baseline_dangers if baseline_dangers is not None else all_dangers

    def _valid_seq(d: Dict[str, Any]) -> bool:
        seq = d.get("fingerprint_seq", []) or []
        return bool(seq) and len(seq) >= MIN_PATTERN_LEN

    base_occ = sum(1 for d in base if _valid_seq(d))
    base_goals = sum(1 for d in base if _valid_seq(d) and bool(d.get("resulted_in_goal", False)))
    baseline_goal_rate = (base_goals / base_occ) if base_occ else 0.0


    total_matches = len(set(d.get("match_name", "UNKNOWN") for d in base))

    # ----------------------------
    # Build clusters from all_dangers
    # ----------------------------
    clusters: List[Pattern] = []

    for d in all_dangers:
        seq: List[str] = d.get("fingerprint_seq", []) or []
        if not seq:
            continue
        if len(seq) < MIN_PATTERN_LEN:
            continue
        if REQUIRE_CAUSE_CODE and not _has_cause_code(seq):
            continue


        match_name = str(d.get("match_name", "UNKNOWN"))
        resulted_in_goal = bool(d.get("resulted_in_goal", False))

        placed = False
        for c in clusters:
            sim = subseq_similarity(seq, c.sequence)
            if sim >= min_subseq_similarity:
                c.matches.add(match_name)
                if len(c.examples) < 5:
                    c.examples.append(d)
                if resulted_in_goal:
                    c.goals_in_pattern += 1

                # keep representative short / interpretable
                if len(seq) < len(c.sequence):
                    c.sequence = seq

                placed = True
                break

        if not placed:
            clusters.append(
                Pattern(
                    sequence=seq,
                    matches={match_name},
                    examples=[d],
                    goals_in_pattern=1 if resulted_in_goal else 0,
                )
            )

    # ----------------------------
    # Score + filter clusters (using baseline set)
    # ----------------------------
    out: List[Dict[str, Any]] = []
    alpha = (1.0 - ci_level) / 2.0

    for c in clusters:
        match_count = len(c.matches)
        if match_count < min_match_frequency:
            continue

        # Count occurrences for this cluster in baseline set
        occurrences = 0
        goals_for_pattern = 0
        deltas: List[int] = []

        for d in base:
            if not _valid_seq(d):
                continue
            seq = d.get("fingerprint_seq", []) or []

            if subseq_similarity(seq, c.sequence) >= min_subseq_similarity:
                occurrences += 1
                if bool(d.get("resulted_in_goal", False)):
                    goals_for_pattern += 1
                if bool(d.get("resulted_in_goal", False)):
                    dt = d.get("time_to_goal_sec", None)
                    if isinstance(dt, (int, float)):
                        deltas.append(int(dt))

        if occurrences < min_occurrences:
            continue

        pattern_goal_rate = goals_for_pattern / occurrences if occurrences else 0.0
        lift = (pattern_goal_rate / baseline_goal_rate) if baseline_goal_rate > 0 else 0.0
        if lift < min_lift:
            continue

        avg_time_to_goal = (sum(deltas) / len(deltas)) if deltas else None

        # ----------------------------
        # Bayesian confidence
        # ----------------------------
        a_post = goals_for_pattern + 1
        b_post = (occurrences - goals_for_pattern) + 1

        ci_low = float(beta.ppf(alpha, a_post, b_post))
        ci_high = float(beta.ppf(1.0 - alpha, a_post, b_post))
        post_mean = float(a_post / (a_post + b_post))

        p_gt_baseline = float(1.0 - beta.cdf(baseline_goal_rate, a_post, b_post))

        support_occ = min(1.0, math.log1p(occurrences) / math.log1p(support_target_occ))
        support_matches = min(1.0, match_count / support_target_matches)
        support_scaler = 0.5 * support_occ + 0.5 * support_matches

        confidence_score = float(p_gt_baseline * support_scaler)

        if confidence_score >= CONF_TIER_HIGH:
            tier = "high"
        elif confidence_score >= CONF_TIER_MED:
            tier = "medium"
        else:
            tier = "low"

        out.append(
            {
                "sequence": c.sequence,
                "match_count": match_count,
                "frequency": f"{match_count}/{total_matches} matches",
                "occurrences": int(occurrences),
                "goals_in_pattern": int(goals_for_pattern),

                "pattern_goal_rate": round(pattern_goal_rate, 4),
                "baseline_goal_rate": round(baseline_goal_rate, 4),
                "lift": round(lift, 3),
                "avg_time_to_goal": (round(avg_time_to_goal, 2) if avg_time_to_goal is not None else None),

                # confidence fields (stable keys for LLM schema)
                "posterior_mean": round(post_mean, 4),
                "ci_level": float(ci_level),
                "ci_low": round(ci_low, 4),
                "ci_high": round(ci_high, 4),
                "p_goal_rate_gt_baseline": round(p_gt_baseline, 4),
                "confidence_score": round(confidence_score, 4),
                "confidence_tier": tier,

                "example_matches": sorted(list(c.matches))[:5],
                "examples": [
                    {
                        "match_name": ex.get("match_name"),
                        "peak_time": ex.get("peak_time"),
                        "peak_score": ex.get("peak_score"),
                        "severity": ex.get("severity"),
                        "resulted_in_goal": ex.get("resulted_in_goal"),
                        "nexus_timestamp": ex.get("nexus_timestamp"),
                    }
                    for ex in c.examples
                ],
            }
        )

    # Sort: confidence first, then lift, then coverage/support
    out.sort(
        key=lambda p: (
            p["confidence_score"],
            p["lift"],
            p["match_count"],
            p["occurrences"],
        ),
        reverse=True,
    )
    return out


def format_patterns_for_llm(patterns: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    """
    Trim patterns down to the fields the LLM should see.
    Keeps it stable + schema-friendly for build_pattern_prompt().
    """
    out: List[Dict[str, Any]] = []
    for p in (patterns or [])[:top_n]:
        out.append(
            {
                "sequence": p.get("sequence", []),
                "frequency": p.get("frequency"),
                "example_matches": p.get("example_matches", []),
                "avg_time_to_goal": p.get("avg_time_to_goal", None),

                # optional extra grounding stats
                "confidence_score": p.get("confidence_score"),
                "confidence_tier": p.get("confidence_tier"),
                "lift": p.get("lift"),
                "occurrences": p.get("occurrences"),
                "goals_in_pattern": p.get("goals_in_pattern"),
                "pattern_goal_rate": p.get("pattern_goal_rate"),
                "baseline_goal_rate": p.get("baseline_goal_rate"),
                "p_goal_rate_gt_baseline": p.get("p_goal_rate_gt_baseline"),
            }
        )
    return out


# ----------------------------
# Quick test runner
# ----------------------------

def _pretty_seq(seq: List[str]) -> str:
    return " → ".join(seq)


def main():
    matches = list_matches()

    baseline = build_all_matches_dangers_for_patterns(matches, mode="all")
    goals = build_all_matches_dangers_for_patterns(matches, mode="goals")

    print(f"Baseline danger moments: {len(baseline)}")
    print(f"Goal danger moments: {len(goals)}")

    patterns = find_patterns(
        goals,
        baseline_dangers=baseline,
        min_subseq_similarity=0.85,
        min_match_frequency=2,
        min_occurrences=3,
        min_lift=1.15,
    )

    print(f"Patterns found: {len(patterns)}\n")

    for p in patterns[:10]:
        print(
            f"{p['frequency']} | occ={p['occurrences']} | goal_rate={p['pattern_goal_rate']} "
            f"| baseline={p['baseline_goal_rate']} | lift={p['lift']} "
            f"| conf={p['confidence_score']} ({p['confidence_tier']}) "
            f"| seq: {_pretty_seq(p['sequence'])} | goals={p['goals_in_pattern']}"
        )
        print(f"examples: {p['example_matches']}")
        if p.get("avg_time_to_goal") is not None:
            print(f"avg_time_to_goal: {p['avg_time_to_goal']} sec")
        print()


if __name__ == "__main__":
    main()