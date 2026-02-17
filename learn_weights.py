"""
ML-based weight learning for the risk engine.

Trains logistic regression and random forest models on all 11 matches
to learn optimal risk weights from actual match outcomes (goals conceded).
Outputs learned weights that plug directly into risk_engine.py.
"""

import pandas as pd
import numpy as np
from data_loader import list_matches, load_events
from risk_engine import _build_time_grid

BARCA_TEAM_NAME = "FC Barcelona"


# ---------------------------------------------------------------------------
# Sub-Part 1: Load all matches
# ---------------------------------------------------------------------------

def load_all_matches() -> list[tuple[str, pd.DataFrame]]:
    """Load events for all available matches.

    Returns list of (match_name, events_df) tuples.
    """
    match_names = list_matches()
    all_matches = []

    for i, name in enumerate(match_names):
        events_df = load_events(i)
        all_matches.append((name, events_df))

    # print summary
    total_events = sum(len(df) for _, df in all_matches)
    all_codes = set()
    for _, df in all_matches:
        all_codes.update(df['code'].unique())

    print(f"Loaded {len(all_matches)} matches, {total_events} total events")
    print(f"Unique event codes ({len(all_codes)}): {sorted(all_codes)}")

    return all_matches


# ---------------------------------------------------------------------------
# Sub-Part 2: Build feature matrix
# ---------------------------------------------------------------------------

def build_feature_matrix(
    match_name: str,
    events_df: pd.DataFrame,
    all_codes: list[str],
    sample_interval: int = 5,
) -> pd.DataFrame:
    """Build a per-second (sampled) feature matrix for one match.

    For every `sample_interval`-th second, creates a row with:
      - binary indicators for each active event code, split by team context
        (opp_<CODE> for opponent events, barca_<CODE> for Barca events)
      - label: 1 if an opponent goal is conceded within the next 60 seconds

    GOALS is excluded from features (data leakage) and N/A team events are skipped.
    """
    time_grid, events_cleaned = _build_time_grid(events_df)

    # identify opponent goal times for labeling
    opponent_goals = events_cleaned[
        (events_cleaned['code'] == 'GOALS') &
        (events_cleaned['Team'] != BARCA_TEAM_NAME) &
        (events_cleaned['Team'] != 'N/A')
    ]
    goal_start_secs = opponent_goals['start_sec'].values

    # feature columns: opp_<CODE> and barca_<CODE> for every code except GOALS
    feature_codes = [c for c in all_codes if c != 'GOALS']
    opp_cols = [f"opp_{c}" for c in feature_codes]
    barca_cols = [f"barca_{c}" for c in feature_codes]

    rows = []
    for t in range(0, len(time_grid), sample_interval):
        # find events active at second t
        active = events_cleaned[
            (events_cleaned['start_sec'] <= t) &
            (events_cleaned['end_sec'] > t) &
            (events_cleaned['code'] != 'GOALS') &
            (events_cleaned['Team'] != 'N/A')
        ]

        # build binary feature vector split by team
        row = {'match': match_name, 'timestamp_sec': t}

        # initialize all features to 0
        for col in opp_cols + barca_cols:
            row[col] = 0

        for _, event in active.iterrows():
            code = event['code']
            team = event['Team']
            if team == BARCA_TEAM_NAME:
                col_name = f"barca_{code}"
            else:
                col_name = f"opp_{code}"
            row[col_name] = 1

        # label: is there an opponent goal within the next 60 seconds?
        row['goal_within_60s'] = int(
            any((t <= gs <= t + 60) for gs in goal_start_secs)
        )

        rows.append(row)

    return pd.DataFrame(rows)


def build_all_features(
    all_matches: list[tuple[str, pd.DataFrame]],
    sample_interval: int = 5,
) -> pd.DataFrame:
    """Build the full feature matrix across all matches."""

    # collect all unique event codes across every match
    all_codes = sorted(set(
        code
        for _, df in all_matches
        for code in df['code'].unique()
    ))

    frames = []
    for match_name, events_df in all_matches:
        df = build_feature_matrix(match_name, events_df, all_codes, sample_interval)
        frames.append(df)

    features_df = pd.concat(frames, ignore_index=True)

    # print summary
    n_positive = features_df['goal_within_60s'].sum()
    n_total = len(features_df)
    feature_cols = [c for c in features_df.columns if c.startswith('opp_') or c.startswith('barca_')]

    print(f"\nFeature matrix: {n_total} samples, {len(feature_cols)} features")
    print(f"Positive samples (goal within 60s): {n_positive} ({100*n_positive/n_total:.2f}%)")
    print(f"Class ratio: {(n_total - n_positive) / max(n_positive, 1):.1f}:1")

    # show which matches contribute positive samples
    print("\nGoals conceded per match:")
    for match_name, _ in all_matches:
        match_rows = features_df[features_df['match'] == match_name]
        n_pos = match_rows['goal_within_60s'].sum()
        print(f"  {match_name}: {n_pos} positive samples")

    return features_df
