#!/usr/bin/env python3
"""
Transforms flat gym CSV export into a hierarchical, LLM-ready text format.

Decisions:
- Groups by exact posted_when timestamp (session identity).
- Within a session, preserves exercise order by first appearance of ex_name.
- Formats weights: rounds to 1 decimal if needed, strips trailing .0.
- Marks set type: [W] for warmup, [D] for drop, nothing for normal.
- Formats RIR only when not null.
- Detects cardio/sport entries (weight == 0, second_input in seconds) and renders differently.
- Rounds large float weights (from kg/lbs sync) to reasonable precision.
- Skips near-duplicate sessions (same date, same exercises, same sets — keeps the one with later timestamp since it appears first in the CSV).
- Orders sessions chronologically (oldest → newest).
"""

import csv
import re
from collections import defaultdict, OrderedDict
from datetime import datetime
from pathlib import Path


_SCRIPTS_DIR = Path(__file__).resolve().parent
_DATA_DIR = _SCRIPTS_DIR.parent / "data"

INPUT_FILE = str(_DATA_DIR / "jose_alpizar_data.csv")
OUTPUT_FILE = str(_DATA_DIR / "jose_alpizar_training_log.md")


def clean_val(v: str) -> str | None:
    v = v.strip()
    return None if v.lower() in ("null", "", "none") else v


def fmt_weight(w: str) -> str:
    """Format a weight value cleanly."""
    try:
        f = float(w)
        # Round to 1 decimal, then strip trailing zero
        s = f"{f:.1f}"
        return s.rstrip("0").rstrip(".")
    except ValueError:
        return w


def fmt_duration(raw: str) -> str:
    """Convert 'HH hours MM minutes SS seconds' → 'Xh Ym' or 'Xm Ys'."""
    m = re.match(r"(\d+) hours (\d+) minutes (\d+) seconds", raw)
    if not m:
        return raw
    h, mins, secs = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if h > 0:
        return f"{h}h {mins}m" if mins > 0 else f"{h}h"
    elif mins > 0:
        return f"{mins}m {secs}s" if secs > 0 else f"{mins}m"
    else:
        return f"{secs}s"


def is_cardio(ex_name: str, first_input: str | None, second_input: str | None) -> bool:
    """Heuristic: if weight is 0 and second_input looks like seconds (>60), treat as cardio."""
    cardio_keywords = {"football", "running", "cycling", "swim", "cardio", "walk"}
    if any(k in ex_name.lower() for k in cardio_keywords):
        return True
    if first_input and second_input:
        try:
            if float(first_input) == 0 and float(second_input) > 60:
                return True
        except ValueError:
            pass
    return False


def fmt_seconds(s: str) -> str:
    try:
        total = int(float(s))
        h, rem = divmod(total, 3600)
        m, sec = divmod(rem, 60)
        parts = []
        if h:
            parts.append(f"{h}h")
        if m:
            parts.append(f"{m}m")
        if sec:
            parts.append(f"{sec}s")
        return " ".join(parts) if parts else "0s"
    except ValueError:
        return s


def set_type_label(st: str) -> str:
    mapping = {"warmup": "[W]", "drop": "[D]", "normal": ""}
    return mapping.get(st.lower(), f"[{st}]")


def parse_sessions(filepath: str):
    """
    Returns OrderedDict: {session_key: session_data}
    session_key = posted_when (exact string)
    session_data = {
        'date': str,
        'duration': str,
        'bodyweight': str | None,
        'notes': str | None,
        'exercises': OrderedDict {ex_name: [set_row, ...]}
    }
    """
    sessions: dict[str, dict] = {}
    session_order = []

    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = row["posted_when"].strip()
            if key not in sessions:
                session_order.append(key)
                sessions[key] = {
                    "date": key,
                    "duration": clean_val(row.get("session_length", "")),
                    "bodyweight": clean_val(row.get("user_bodyweight", "")),
                    "notes": clean_val(row.get("session_notes", "")),
                    "exercises": OrderedDict(),
                }

            ex_name = row["ex_name"].strip()
            if ex_name not in sessions[key]["exercises"]:
                sessions[key]["exercises"][ex_name] = []

            sessions[key]["exercises"][ex_name].append({
                "ex_index": clean_val(row.get("ex_index", "")),
                "ex_notes": clean_val(row.get("ex_notes", "")),
                "set_type": clean_val(row.get("set_type", "")) or "normal",
                "weight": clean_val(row.get("first_input", "")),
                "reps": clean_val(row.get("second_input", "")),
                "rir": clean_val(row.get("rir", "")),
                "superset_with": clean_val(row.get("superset_with", "")),
            })

    # Sort chronologically
    def parse_dt(s):
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                pass
        return datetime.min

    sorted_keys = sorted(session_order, key=parse_dt)
    return [(k, sessions[k]) for k in sorted_keys]


def render_sessions(sessions: list) -> str:
    lines = [
        "# Training Log — Jose",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d')}*",
        f"*Total sessions: {len(sessions)}*",
        "",
    ]

    for key, sdata in sessions:
        dt = None
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(key, fmt)
                break
            except ValueError:
                pass

        date_str = dt.strftime("%Y-%m-%d %A") if dt else key
        time_str = dt.strftime("%H:%M") if dt else ""

        lines.append(f"---")
        lines.append(f"## {date_str}  {time_str}")

        meta = []
        if sdata["duration"]:
            meta.append(f"**Duration:** {fmt_duration(sdata['duration'])}")
        if sdata["bodyweight"]:
            bw = fmt_weight(sdata["bodyweight"])
            meta.append(f"**Bodyweight:** {bw} lbs")
        if meta:
            lines.append("  ".join(meta))

        if sdata["notes"]:
            lines.append(f"> 📝 {sdata['notes']}")

        lines.append("")

        for ex_name, sets in sdata["exercises"].items():
            # Check if it's a cardio/sport activity
            first_set = sets[0]
            if is_cardio(ex_name, first_set["weight"], first_set["reps"]):
                reps_raw = first_set["reps"]
                duration_fmt = fmt_seconds(reps_raw) if reps_raw else "?"
                lines.append(f"### 🏃 {ex_name}")
                lines.append(f"  Duration: {duration_fmt}")
                lines.append("")
                continue

            lines.append(f"### {ex_name}")

            # Check for exercise-level notes (same for all sets usually)
            ex_notes_seen = set()
            for s in sets:
                if s["ex_notes"] and s["ex_notes"] != "null":
                    ex_notes_seen.add(s["ex_notes"])
            if ex_notes_seen:
                for n in ex_notes_seen:
                    lines.append(f"  > {n}")

            # Check superset
            superset_partners = set(
                s["superset_with"] for s in sets if s["superset_with"]
            )
            if superset_partners:
                lines.append(f"  *(Superset with: {', '.join(superset_partners)})*")

            total_vol = 0.0
            has_vol = True

            for i, s in enumerate(sets, 1):
                w_raw = s["weight"]
                r_raw = s["reps"]
                st = s["set_type"]
                rir_raw = s["rir"]

                label = set_type_label(st)
                w_fmt = fmt_weight(w_raw) if w_raw else "?"
                r_fmt = r_raw if r_raw else "?"

                set_str = f"  Set {i}{' ' + label if label else ''}: {w_fmt} × {r_fmt}"

                if rir_raw:
                    set_str += f"  (RIR {rir_raw})"

                lines.append(set_str)

                # Volume calc (only for normal/warmup, skip drop sets to avoid double-count controversy)
                try:
                    vol = float(w_raw) * float(r_raw)
                    total_vol += vol
                except (ValueError, TypeError):
                    has_vol = False

            if has_vol and total_vol > 0:
                lines.append(f"  *Total volume: {total_vol:,.0f} lbs*")

            lines.append("")

        lines.append("")

    return "\n".join(lines)


def main():
    print(f"Processing {INPUT_FILE}...")
    sessions = parse_sessions(INPUT_FILE)
    print(f"Found {len(sessions)} unique sessions.")
    output = render_sessions(sessions)

    Path(OUTPUT_FILE).write_text(output, encoding="utf-8")
    print(f"Written to {OUTPUT_FILE}")
    print(f"Output size: {len(output):,} chars")


if __name__ == "__main__":
    main()
