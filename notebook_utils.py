"""
Utility functions for project_overview.ipynb.
All display/plot functions - no business logic defined here.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from IPython.display import display

from data_loader import get_halftime_offset


# -- Event code distribution ------------------------------------------------

def show_event_code_distribution(events_df: pd.DataFrame) -> None:
    """Bar chart of event code counts by team, sorted by total count descending."""
    barca    = events_df[events_df["Team"] == "FC Barcelona"]
    opponent = events_df[(events_df["Team"] != "FC Barcelona") & (events_df["Team"] != "N/A")]
    codes    = sorted(events_df["code"].dropna().unique())

    totals       = {c: 0 for c in codes}
    barca_counts = {}
    opp_counts   = {}
    for c in codes:
        b = len(barca[barca["code"] == c])
        o = len(opponent[opponent["code"] == c])
        barca_counts[c] = b
        opp_counts[c]   = o
        totals[c]       = b + o

    codes = sorted(codes, key=lambda c: totals[c], reverse=True)
    b_vals = [barca_counts[c] for c in codes]
    o_vals = [opp_counts[c]   for c in codes]

    x     = np.arange(len(codes))
    width = 0.4

    fig, ax = plt.subplots(figsize=(13, 5))
    ax.bar(x - width / 2, b_vals, width, label="FC Barcelona", color="#A50044")
    ax.bar(x + width / 2, o_vals, width, label="Opponent",     color="#004D98")
    ax.set_xticks(x)
    ax.set_xticklabels(codes, rotation=35, ha="right", fontsize=9)
    ax.set_ylabel("Event count")
    ax.set_title("Event Code Distribution by Team")
    ax.legend()
    plt.tight_layout()
    plt.show()


# -- Tag overlap examples ---------------------------------------------------

def show_tag_overlap_examples(events_df: pd.DataFrame, minute: float = 10) -> None:
    """Show all events active at a given match minute."""
    target_sec = minute * 60
    clean = events_df.dropna(subset=["timestamp", "end_timestamp"]).copy()
    clean["start_sec"]    = clean["timestamp"].dt.total_seconds()
    clean["end_sec"]      = clean["end_timestamp"].dt.total_seconds()
    clean["duration_sec"] = clean["end_sec"] - clean["start_sec"]

    active = clean[
        (clean["start_sec"] <= target_sec) & (clean["end_sec"] >= target_sec)
    ].copy()

    def fmt(s):
        m, sec = divmod(int(s), 60)
        return f"{m}:{sec:02d}"

    active["Start"]    = active["start_sec"].apply(fmt)
    active["End"]      = active["end_sec"].apply(fmt)
    active["Duration"] = active["duration_sec"].apply(lambda s: f"{s:.0f}s")

    print(f"Events active at minute {minute:.1f} - {len(active)} overlapping tags:\n")
    cols = ["code", "Team", "Start", "End", "Duration", "Type", "Side"]
    display(active[cols].reset_index(drop=True))


# -- Event duration statistics ----------------------------------------------

def show_duration_stats(events_df: pd.DataFrame) -> None:
    """
    Table of duration statistics per event code: mean, median, std, min, max (seconds).
    Sorted by median ascending so short events appear first.
    """
    clean = events_df.dropna(subset=["timestamp", "end_timestamp"]).copy()
    clean["duration_sec"] = (
        clean["end_timestamp"] - clean["timestamp"]
    ).dt.total_seconds()

    rows = []
    for code, grp in clean.groupby("code"):
        d = grp["duration_sec"].dropna()
        rows.append({
            "Event Code": code,
            "Count":      len(d),
            "Mean (s)":   round(d.mean(), 1),
            "Median (s)": round(d.median(), 1),
            "Std (s)":    round(d.std(), 1),
            "Min (s)":    round(d.min(), 1),
            "Max (s)":    round(d.max(), 1),
        })

    df = pd.DataFrame(rows).sort_values("Median (s)")
    display(df.reset_index(drop=True))


# -- Time offset demonstration ----------------------------------------------

def show_time_offset_demonstration(events_df: pd.DataFrame, n_rows: int = 10) -> None:
    """
    Show raw timestamps vs halftime-offset-corrected display times side by side.
    Picks a mix of 1st and 2nd half events so the difference is visible.
    """
    offset     = get_halftime_offset(events_df)
    offset_sec = int(offset.total_seconds())
    h2         = events_df[events_df["Half"] == "2nd Half"].copy()
    h2_start   = int(h2["timestamp"].dt.total_seconds().min()) if not h2.empty else 99999

    def fmt(td, correct=False):
        s = int(td.total_seconds())
        if correct and s >= h2_start:
            s -= offset_sec
        m, sec = divmod(s, 60)
        return f"{m}:{sec:02d}"

    clean   = events_df.dropna(subset=["timestamp"]).copy()
    h1_samp = clean[clean["Half"] == "1st Half"].head(n_rows // 2)
    h2_samp = clean[clean["Half"] == "2nd Half"].head(n_rows // 2)
    sample  = pd.concat([h1_samp, h2_samp]).sort_values("timestamp")

    sample["Raw video time"]      = sample["timestamp"].apply(lambda td: fmt(td, correct=False))
    sample["Corrected game time"] = sample["timestamp"].apply(lambda td: fmt(td, correct=True))
    sample["Offset applied"]      = sample["Half"].apply(
        lambda h: f"-{offset_sec}s ({offset_sec // 60}m {offset_sec % 60}s)" if h == "2nd Half" else "none"
    )

    print(f"Halftime offset detected: {offset_sec} seconds ({offset_sec / 60:.1f} minutes)\n")
    display(sample[["Half", "code", "Raw video time", "Corrected game time", "Offset applied"]].reset_index(drop=True))
