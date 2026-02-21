# FC Barcelona Defensive Fault Lines

**Interpretation Document — More than a Hack 2026**

---

An analytical system that identifies defensive vulnerabilities in FC Barcelona matches using time-series event data, Bayesian pattern detection, and LLM-assisted tactical explanations. Built on Metrica Sports Smart Tagging data across 11 matches.

> **Tactical Question:** *When and how does Barcelona's defensive structure break down, and which vulnerability patterns recur across matches?*

**Scope:** Scope 2 (Game modeling and pattern detection) with elements of Scope 1 (Interpretation) and multi-match comparative analysis.

---

## Table of Contents

1. [Data Sources and Limitations](#1-data-sources-and-limitations)
2. [Methodology: Risk Scoring Pipeline](#2-methodology-risk-scoring-pipeline)
3. [Danger Moment Detection](#3-danger-moment-detection)
4. [Match-by-Match Findings](#4-match-by-match-findings)
5. [Cross-Match Pattern Analysis](#5-cross-match-pattern-analysis)
6. [LLM Integration](#6-llm-integration)
7. [Interactive Dashboard](#7-interactive-dashboard)
8. [Limitations and Honest Disclosure](#8-limitations-and-honest-disclosure)
9. [Coaching Recommendations](#9-coaching-recommendations)

---

## 1. Data Sources and Limitations

### 1.1 Available Data Per Match

| Source | Format | Content | Coverage |
|--------|--------|---------|----------|
| Smart Tagging | `*_pattern.xml` | Team-level tactical phases: BUILD UP, PROGRESSION, CREATING CHANCES, etc. | Full match, both teams |
| ATD Metadata | `*_FifaData.xml` | Team names, player track IDs, pitch dimensions, frame rate | Complete metadata |
| ATD Positions | `*_FifaDataRawData.txt` | Per-frame x/y/speed for ball + player tracks | Ball: good. Outfield players: mostly NaN |
| Broadcast Video | `*.mp4` | Full match recording | All 11 matches |

### 1.2 Critical Limitation: Tracking Sparsity

The ATD tracking feed provides position data generated from broadcast camera footage. Because broadcast cameras follow the ball, players frequently go off-screen, resulting in NaN values. Additionally, the ATD is team-level (no player identifiers) with identity fragmentation (40–60 extra IDs per match). This means:

- Individual player metrics (progressive carries, press resistance) are **not feasible**
- Defensive shape, compactness, or line height **cannot be determined** from tracking
- Ball position is usable and provides limited spatial context
- The system is built primarily on **team-level event phase data**

### 1.3 Smart Tagging Event Codes

| Event Code | Description | Risk Weight (Opp / Barça) |
|------------|-------------|--------------------------|
| GOALS | Goal scored | 10 / 0 |
| BALL IN THE BOX | Ball enters penalty area | 8 / 0 |
| CREATING CHANCES | Clear goal-scoring opportunity | 7 / 0 |
| BALL IN FINAL THIRD | Ball in attacking third | 5 / 0 |
| ATTACKING TRANSITION | Counter-attack initiated | 4 / 0 |
| PROGRESSION | Ball advanced through lines | 3 / 0 |
| SET PIECES | Corner, free kick, throw-in | 3 / 0 |
| DEFENDING IN DEF. THIRD | Defending near own goal | 0 / 4 |
| DEFENSIVE TRANSITION | Losing possession, recovering | 0 / 3 |
| DEFENDING IN MID. THIRD | Defending in middle third | 0 / 2 |
| DEFENDING IN ATK. THIRD | High press / defending forward | 0 / 1 |
| LONG BALL | Direct long-distance pass | 0 / 0 |
| BUILD UP | Possession from own half | 0 / 0 |
| PLAYERS IN THE BOX | Attackers in penalty area | 0 / 0 |

*Note: Smart Tagging is not manually ground-truthed. It may contain false positives and negatives.*

### 1.4 Project Pivot

The original concept was individual player performance analysis. Due to tracking identity fragmentation and sparse position data, we pivoted to team-wide defensive analysis — a question fully answerable from the Smart Tagging data, which is clean and complete.

---

## 2. Methodology: Risk Scoring Pipeline

The pipeline converts raw Smart Tagging annotations into a continuous per-second risk score (0–100) for each match.

### 2.1 Time Grid and Raw Score

Events are converted to integer seconds. For each second of the match, we identify all active events and sum their risk weights. Opponent attacking events contribute positive risk; Barça defensive-phase events add additional risk (being in DEFENDING IN DEFENSIVE THIRD means the team is under pressure). Multiple overlapping events compound — this captures the combinatorial danger of simultaneous attacking and defensive breakdowns.

### 2.2 Smoothing and Normalization

Raw scores are smoothed with a 15-second centered rolling mean to prevent artificial drops when events end. Scores are then normalized to 0–100 against the theoretical maximum (sum of all non-GOALS weights = 30). This means:

- Dangerous play without a goal tops out around 70–80
- Only a GOALS event (+10) can push the score toward 100
- Goal moments are spiked to 100 in the final 5 seconds of the GOALS annotation window

### 2.3 Design Rationale

The weight system is intentionally transparent and interpretable. Each weight reflects the proximity-to-goal of the tactical phase: events closer to the goal (BALL IN THE BOX, CREATING CHANCES) receive higher weights than upstream events (PROGRESSION, BUILD UP). This produces risk scores that align with coaching intuition — sustained pressure in the final third creates higher risk than possession in midfield.

---

## 3. Danger Moment Detection

Danger moments are identified using scipy's `find_peaks` algorithm on the risk timeline.

### 3.1 Detection Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Peak percentile | 70th | Dynamic threshold — peaks must exceed this |
| Threshold floor | 40.0 | Absolute minimum (avoids trivial peaks in low-action matches) |
| Min distance | 35 sec | Minimum gap between detected peaks |
| Prominence | 10.0 | Peak must rise 10+ above surrounding baseline |
| Goal lookback | 90 sec | Search window for risk peak before a goal |
| Merge window | 60 sec | Merge peaks within 60s into one sustained spell |

These parameters were tuned using a grid search across all 11 matches, optimizing for: reasonable peak count per match (~10–20), window lengths between 20–60 seconds, and 100% goal coverage (every goal against has an associated danger moment).

### 3.2 Severity Classification

| Severity | Score Range | Meaning |
|----------|-------------|---------|
| Critical | 85–100 | Goal conceded or near-certain opportunity |
| High | 70–84 | Clear danger, multiple threatening events |
| Moderate | 40–69 | Elevated risk, territorial opponent advantage |

### 3.3 Goal Anchoring

Every goal conceded is guaranteed to appear as a critical danger moment. The system looks back 90 seconds from the goal timestamp and takes the max-risk point. If within 5 seconds of an existing peak, it is promoted rather than duplicated. This ensures 100% goal coverage while avoiding artificial inflation.

### 3.4 Merge Logic

Peaks within 60 seconds of each other are merged into a single sustained pressure spell. The merged moment keeps the highest peak score, the widest window, the union of active codes, and the maximum severity. This prevents a single sustained attack from fragmenting into multiple entries.

---

## 4. Match-by-Match Findings

### 4.1 Overview

The pipeline processed 11 FC Barcelona matches, detecting **144 danger moments** across all matches.

| Statistic | Value |
|-----------|-------|
| Total matches analyzed | 11 |
| Total goals: Barça scored | 32 |
| Total goals: Opponents scored | 17 |
| Total danger moments detected | 144 |
| Critical severity | 21 (14.6%) |
| High severity | 22 (15.3%) |
| Moderate severity | 101 (70.1%) |
| Goal-anchored moments | 17/17 (100% coverage) |
| Average danger moments per match | 13.1 |

### 4.2 Match-by-Match Breakdown

| Match | Opponent | Score | Dangers | Critical | High | Moderate | Goal-Anchored | Avg Risk |
|-------|----------|-------|---------|----------|------|----------|---------------|----------|
| 1 | AC Milan (A) | 1-0 | 15 | 0 | 2 | 13 | 0 | 10.7 |
| 2 | Arsenal (A) | 3-5 | 22 | 6 | 1 | 15 | 5 | 12.6 |
| 3 | AC Milan (H) | 2-2 | 10 | 2 | 1 | 7 | 2 | 6.5 |
| 4 | AS Monaco (H) | 0-3 | 12 | 5 | 3 | 4 | 3 | 9.4 |
| 5 | Como (H) | 5-0 | 13 | 0 | 2 | 11 | 0 | 8.3 |
| 6 | Manchester City (H) | 2-2 | 20 | 3 | 5 | 12 | 2 | 14.5 |
| 7 | Real Madrid (H) | 3-0 | 21 | 0 | 3 | 18 | 0 | 13.3 |
| 8 | Daegu FC (A) | 5-0 | 3 | 0 | 1 | 2 | 0 | 3.0 |
| 9 | FC Seoul (A) | 7-3 | 10 | 3 | 1 | 6 | 3 | 6.4 |
| 10 | Real Madrid (A) | 2-1 | 15 | 1 | 2 | 12 | 1 | 9.3 |
| 11 | Vissel Kobe (A) | 3-1 | 3 | 1 | 1 | 1 | 1 | 4.8 |

**(H) = Home, (A) = Away**

### 4.3 Key Observations

**High-danger matches:** The Arsenal (5-3) and Manchester City (2-2) matches produced the most danger moments (22 and 20 respectively), reflecting their quality as opponents and the open, transitional nature of those games.

**Monaco (0-3) — worst defensive performance:** Despite only 12 danger moments, 5 were critical and all 3 goals were captured. The high critical-to-total ratio (42%) indicates concentrated, lethal attacks rather than sustained pressure.

**Dominant wins still produce risk:** Even in the 5-0 wins (Como, Daegu), the system detected moderate danger moments — consistent with the reality that even dominant teams face occasional counter-attacks or set-piece threats.

**Real Madrid (3-0 win) — high moderate count:** 21 danger moments with 0 critical suggests a match where Barcelona controlled the outcome but faced consistent mid-level pressure, likely from Real Madrid's territorial play.

### 4.4 Visualizations

*See attached figures:*
- **Figure 1:** Danger Moment Severity Distribution by Match (`severity_by_match.png`)
- **Figure 2:** Defensive Risk Profile by Match (`risk_profile_by_match.png`)
- **Figure 3:** Risk Timeline — Arsenal vs Barça 5-3 (`risk_timeline_arsenal.png`)
- **Figure 4:** Risk Timeline — Barça vs AS Monaco 0-3 (`risk_timeline_monaco.png`)
- **Figure 5:** Danger Moments vs Goals Conceded (`dangers_vs_goals.png`)

### 4.5 Event Code Frequency in Danger Moments

Across all 144 danger moments, the most frequently active event codes were:

| Event Code | Frequency | % of Danger Moments |
|------------|-----------|-------------------|
| PLAYERS IN THE BOX | 140 | 97.2% |
| BALL IN FINAL THIRD | 137 | 95.1% |
| BALL IN THE BOX | 128 | 88.9% |
| ATTACKING TRANSITION | 69 | 47.9% |
| DEFENSIVE TRANSITION | 69 | 47.9% |
| CREATING CHANCES | 62 | 43.1% |
| DEFENDING IN DEF. THIRD | 62 | 43.1% |
| PROGRESSION | 61 | 42.4% |
| DEFENDING IN MID. THIRD | 61 | 42.4% |
| SET PIECES | 52 | 36.1% |

The near-universal presence of PLAYERS IN THE BOX and BALL IN FINAL THIRD in danger moments validates the weight system: danger moments are, by definition, moments where the opponent has penetrated into advanced areas. The 48% co-occurrence of ATTACKING TRANSITION and DEFENSIVE TRANSITION highlights transition play as a primary vulnerability vector.

*See attached: Figure 6 — Event Code Frequency in Danger Moments (`code_frequency.png`)*

---

## 5. Cross-Match Pattern Analysis

### 5.1 Methodology

For each danger moment, we extract a **fingerprint**: the sequence of event codes that newly entered the active set during the preceding 60 seconds. Codes are filtered by stopwords (removing ubiquitous codes like BALL IN FINAL THIRD that appear in nearly every danger moment), deduplicated while preserving order, and compressed to the top 4 by weight. This produces short, interpretable sequences that capture the tactical story leading to danger.

Fingerprints are clustered using subsequence similarity (threshold 0.85). Patterns must appear in ≥2 matches with ≥3 total occurrences and lift ≥1.15 over baseline to be reported.

### 5.2 Bayesian Confidence Scoring

Each pattern's goal rate is modeled as Bernoulli with a Beta(1,1) prior. The composite confidence score = P(pattern_rate > baseline_rate) × support_scaler.

| Tier | Score | Coaching Guidance |
|------|-------|------------------|
| High | ≥ 0.70 | Recurring vulnerability. Address in tactical sessions. |
| Medium | 0.45–0.69 | Notable pattern. Monitor in upcoming matches. |
| Low | < 0.45 | Candidate theme. Insufficient evidence to act on. |

### 5.3 Detected Patterns

The pattern analyzer identified **3 recurring vulnerability patterns** across the 11 matches:

#### Pattern 1: ATTACKING TRANSITION → DEFENSIVE TRANSITION
- **Confidence:** 0.601 (Medium)
- **Lift:** 2.66× baseline
- **Occurrences:** 10 (3 resulted in goals)
- **Matches:** Arsenal (5-3), AC Milan (2-2), FC Seoul (3-7)

**Tactical interpretation:** This pattern captures moments where Barcelona loses the ball during an attacking move and the opponent immediately launches a counter-attack. The rapid transition from attack to defense — with players caught upfield — creates the most dangerous vulnerability in the dataset. The 2.66× lift over baseline means this sequence is nearly 3 times more likely to result in a goal than an average danger moment.

#### Pattern 2: CREATING CHANCES → DEFENDING IN DEFENSIVE THIRD
- **Confidence:** 0.471 (Medium)
- **Lift:** 1.97× baseline
- **Occurrences:** 9 (2 resulted in goals)
- **Matches:** Arsenal (5-3), AS Monaco (0-3)

**Tactical interpretation:** This captures situations where the opponent's chance creation directly pushes Barcelona into deep defending. The proximity of chance creation to defensive-third defending suggests that Barcelona's mid-block is being bypassed — the opponent progresses from creating chances to box-area threats without an intermediate defensive phase, indicating a structural gap in the mid-block.

#### Pattern 3: PROGRESSION → DEFENDING IN MIDDLE THIRD
- **Confidence:** 0.463 (Medium)
- **Lift:** 1.48× baseline
- **Occurrences:** 12 (2 resulted in goals)
- **Matches:** AS Monaco (0-3), FC Seoul (3-7)

**Tactical interpretation:** Opponent progression through midfield while Barcelona is defending in the middle third. The 1.48× lift suggests that when opponents successfully progress through the mid-block, it frequently escalates to danger. This pattern appeared in both heavy-defeat matches (Monaco, Seoul), indicating that when Barcelona's midfield pressing is ineffective, the defensive line is exposed.

### 5.4 Baseline Statistics

| Metric | Value |
|--------|-------|
| Total danger moments with valid fingerprints | 144 |
| Baseline goal rate (any danger moment → goal) | 11.8% |
| Pattern 1 goal rate | 30.0% (2.66× baseline) |
| Pattern 2 goal rate | 22.2% (1.97× baseline) |
| Pattern 3 goal rate | 16.7% (1.48× baseline) |

---

## 6. LLM Integration

### 6.1 Role of the LLM

The system uses GPT-4o-mini (via OpenRouter) to transform structured evidence packs into natural-language tactical explanations. The LLM never sees raw data — only curated context containing: the match name, opponent, danger window timestamps, risk score, severity, active event codes, and whether a goal resulted.

### 6.2 Prompt Architecture

| Template | Input | Output |
|----------|-------|--------|
| Moment prompt | Active codes, risk score, severity, goal flag | 3–5 sentence tactical explanation with [CODE] refs |
| Window prompt | Events in 5-min window, avg risk, team breakdown | Tactical summary of passage of play |
| Pattern prompt | Sequence, frequency, confidence stats | Structural vulnerability explanation + recommendations |

### 6.3 Example LLM Output

**Match:** AC Milan vs Barça (0-1)
**Danger window:** 37:01 – 37:46 (peak at 37:17, risk score 77.17, severity: high)

> *"During the critical window from 37:01 to 37:46, Barcelona's defensive structure appeared to falter primarily due to poor organization during the [DEFENSIVE TRANSITION]. As AC Milan initiated an [ATTACKING TRANSITION], Barcelona's players were slow to regroup, leading to unmarked opposition players in the [FINAL THIRD]. The lack of effective communication and commitment to closing down space in the [DEFENDING IN DEFENSIVE THIRD] allowed Milan to create multiple [BALL IN THE BOX] scenarios. To address these vulnerabilities, the coaching staff should emphasize rapid defensive recovery drills and reinforce the importance of spatial awareness during transitions."*

### 6.4 Hallucination Mitigation

- **Data-limitation-aware system prompt:** Explicitly tells the LLM what data IS and IS NOT available. States that events are team-level, preventing fabrication of individual player actions.
- **Code citation requirement:** Event codes must be cited in [BRACKETS], making analysis verifiable against the evidence pack.
- **Confidence-gated language:** Only patterns with confidence ≥ 0.60 are called "recurring." Lower-confidence patterns are hedged as "candidate themes to monitor."
- **No invented timestamps:** The LLM is instructed not to repeat timestamps. The UI displays them separately from authoritative data.

### 6.5 Caching

All LLM responses are cached (SHA-256 of prompt → JSON file). Identical evidence packs produce identical explanations, ensuring reproducibility and avoiding redundant API calls.

---

## 7. Interactive Dashboard

A React + FastAPI dashboard allows coaching staff to explore the analysis interactively:

- **Match selector:** Choose from all 11 matches
- **Risk timeline chart:** Color-coded risk score over match time with goal markers
- **Danger moment list:** Clickable cards ranked by severity with LLM explanations
- **Video seek:** Click a danger moment to jump to the corresponding broadcast timestamp
- **Custom window analysis:** Click two points on the timeline to get an LLM explanation of any passage of play

The dashboard connects to the FastAPI backend which computes risk scores on demand and caches results. Video offset calibration (pre-match broadcast time, halftime extra time) is stored per match to enable accurate video seeking.

---

## 8. Limitations and Honest Disclosure

### 8.1 What the System CAN Do

- Identify specific time windows where Barça was most defensively vulnerable
- Quantify danger severity on a 0–100 scale with three tiers
- Detect recurring event sequences preceding danger across matches
- Provide Bayesian confidence levels for pattern recurrence
- Generate LLM explanations constrained to available evidence
- Link danger moments to broadcast video timestamps

### 8.2 What the System CANNOT Do

- Attribute defensive failures to **individual players** (events are team-level)
- Analyze defensive shape, compactness, or pressing structure (tracking too sparse)
- Compute player-level xG, progressive carries, or dribble success rates
- Determine **causal** relationships (patterns are correlational)
- Replace expert coaching judgment — the system is an analytical aid

### 8.3 LLM Output Caveats

LLM explanations are constrained to the evidence pack but are not infallible. Subtle inference errors (attributing causation to correlation, over-interpreting limited data) may occur. All outputs should be reviewed by coaching staff before informing tactical decisions.

### 8.4 Sample Size

With 11 matches, pattern analysis has limited statistical power. Patterns appearing in 2–3 matches may be coincidental. The Bayesian framework accounts for this (small sample → wide credible intervals → lower confidence), but coaches should treat medium/low confidence patterns as hypotheses, not confirmed weaknesses.

### 8.5 Smart Tagging Accuracy

Smart Tagging data is not manually ground-truthed. It is inferred through automated processes and may contain both false positives and false negatives. The risk engine inherits any labeling errors present in the source data.

---

## 9. Coaching Recommendations

Based on the cross-match analysis, we recommend the coaching staff focus on:

1. **Transition vulnerability (Pattern 1, confidence 0.60):** The ATTACKING TRANSITION → DEFENSIVE TRANSITION pattern is the strongest signal in the dataset. When Barcelona loses possession during attacks, the speed of recovery is insufficient to prevent counter-attacks from reaching dangerous areas. Rapid defensive recovery drills and positional discipline when committing players forward should be prioritized.

2. **Mid-block bypass (Pattern 2, confidence 0.47):** Opponents who create chances tend to quickly reach Barcelona's defensive third without an intermediate defensive phase. This suggests the mid-block is being bypassed rather than pressured through. Reviewing the pressing triggers and compactness between lines would address this.

3. **Midfield progression control (Pattern 3, confidence 0.46):** When opponents successfully progress through midfield while Barcelona defends in the middle third, danger escalates. Strengthening the midfield press and ensuring defensive cover during transitions would reduce the frequency of this pattern.

4. **Use the video linkage:** Every danger moment maps to a broadcast timestamp. Review footage alongside the LLM explanation for the richest analytical context.

5. **Monitor patterns in future matches:** All three detected patterns are at medium confidence. Track whether they appear in subsequent matches to determine if they represent structural issues or situational anomalies.

---

*This document was generated programmatically. Tactical explanations within the system are assisted by GPT-4o-mini (via OpenRouter). All statistical analysis, risk scoring, pattern detection, and verification logic is deterministic Python code.*