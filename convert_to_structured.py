#!/usr/bin/env python3
"""
Converts the cleaned markdown training log into a semi-structured
key-value format optimized for LLM computational analysis.

Input:  /home/pablo/gym/jose_alpizar_training_log.md
Output: /home/pablo/gym/jose_alpizar_structured.txt
"""

import re
from pathlib import Path
from datetime import datetime

INPUT  = "/home/pablo/gym/jose_alpizar_training_log.md"
OUTPUT = "/home/pablo/gym/jose_alpizar_structured.txt"


# ── helpers ──────────────────────────────────────────────────────────────────

def parse_duration_to_minutes(raw: str) -> str:
    """'1h 6m' | '53m 42s' | '0s' → decimal minutes string."""
    h = m = s = 0
    raw = raw.strip()
    mh = re.search(r"(\d+)h", raw)
    mm = re.search(r"(\d+)m(?!in)", raw)
    ms = re.search(r"(\d+)s", raw)
    if mh: h = int(mh.group(1))
    if mm: m = int(mm.group(1))
    if ms: s = int(ms.group(1))
    total = h * 60 + m + s / 60
    return f"{total:.2f}"


def clean_float(v: str) -> str:
    """Remove trailing .0 from floats; keep meaningful decimals."""
    try:
        f = float(v)
        s = f"{f:.2f}".rstrip("0").rstrip(".")
        return s
    except ValueError:
        return v


SET_TYPE_MAP = {
    "[W]": "warmup",
    "[D]": "drop",
    "":    "normal",
}

# ── parser ───────────────────────────────────────────────────────────────────

class Session:
    def __init__(self):
        self.date            = ""
        self.duration_raw    = ""
        self.bodyweight      = ""
        self.notes           = ""
        self.exercises: list = []   # list of Exercise dicts


def parse_markdown(path: str) -> list[Session]:
    sessions: list[Session] = []
    cur: Session | None = None
    cur_ex: dict | None = None

    date_re     = re.compile(r"^## (\d{4}-\d{2}-\d{2})\s+\w+\s+(\d{2}:\d{2})")
    meta_re     = re.compile(r"\*\*Duration:\*\*\s*([^\s].*?)(?:\s{2}|\s*$)")
    bw_re       = re.compile(r"\*\*Bodyweight:\*\*\s*([\d.]+)")
    ex_re       = re.compile(r"^### (.+)")
    set_re      = re.compile(
        r"^\s+Set\s+\d+\s*(\[W\]|\[D\])?\s*:\s*([\d.]+)\s*[×x]\s*([\d.]+)"
        r"(?:\s+\(RIR\s*([\d.]+)\))?"
    )
    cardio_re   = re.compile(r"^\s+Duration:\s*(.+)")
    vol_re      = re.compile(r"^\s+\*Total volume:\s*([\d,]+)")
    note_re     = re.compile(r"^>\s*📝\s*(.+)")
    ex_note_re  = re.compile(r"^\s+>\s*(.+)")

    def flush_exercise():
        nonlocal cur_ex
        if cur_ex and cur:
            cur.exercises.append(cur_ex)
        cur_ex = None

    for line in Path(path).read_text(encoding="utf-8").splitlines():
        # New session header
        m = date_re.match(line)
        if m:
            flush_exercise()
            if cur:
                sessions.append(cur)
            cur = Session()
            cur.date = f"{m.group(1)}T{m.group(2)}"
            cur_ex = None
            continue

        if cur is None:
            continue

        # Duration + bodyweight metadata line
        if "**Duration:**" in line:
            dm = meta_re.search(line)
            bm = bw_re.search(line)
            if dm:
                cur.duration_raw = dm.group(1).strip()
            if bm:
                cur.bodyweight = clean_float(bm.group(1))
            continue

        # Session notes (skip — do not include in output)
        if note_re.match(line):
            continue

        # Exercise header
        m = ex_re.match(line)
        if m:
            flush_exercise()
            cur_ex = {
                "name":   m.group(1).strip(),
                "is_cardio": False,
                "sets":   [],
                "total_volume": None,
            }
            continue

        if cur_ex is None:
            continue

        # Cardio duration line
        m = cardio_re.match(line)
        if m and cur_ex.get("is_cardio") is True:
            dur_str = m.group(1).strip()
            # parse to seconds
            h = mn = s = 0
            mh = re.search(r"(\d+)h", dur_str)
            mm2 = re.search(r"(\d+)m(?!in)", dur_str)
            ms2 = re.search(r"(\d+)s", dur_str)
            if mh:  h  = int(mh.group(1))
            if mm2: mn = int(mm2.group(1))
            if ms2: s  = int(ms2.group(1))
            cur_ex["duration_seconds"] = h * 3600 + mn * 60 + s
            continue

        # Detect cardio exercises (🏃 prefix added by formatter)
        if cur_ex and "🏃" in cur_ex["name"]:
            cur_ex["is_cardio"] = True
            m = cardio_re.match(line)
            if m:
                dur_str = m.group(1).strip()
                h = mn = s = 0
                mh  = re.search(r"(\d+)h",      dur_str)
                mm2 = re.search(r"(\d+)m(?!in)", dur_str)
                ms2 = re.search(r"(\d+)s",       dur_str)
                if mh:  h  = int(mh.group(1))
                if mm2: mn = int(mm2.group(1))
                if ms2: s  = int(ms2.group(1))
                cur_ex["duration_seconds"] = h * 3600 + mn * 60 + s
            continue

        # Exercise-level note (skip)
        if ex_note_re.match(line):
            continue

        # Set line
        m = set_re.match(line)
        if m:
            type_tag = m.group(1) or ""
            set_type = SET_TYPE_MAP.get(type_tag.strip(), "normal")
            weight   = clean_float(m.group(2))
            reps     = m.group(3)
            rir      = m.group(4) if m.group(4) else None
            s_dict   = {"weight": weight, "reps": reps, "type": set_type}
            if rir:
                s_dict["rir"] = rir
            cur_ex["sets"].append(s_dict)
            continue

        # Total volume
        m = vol_re.match(line)
        if m:
            cur_ex["total_volume"] = m.group(1).replace(",", "")
            continue

    # flush last
    flush_exercise()
    if cur:
        sessions.append(cur)

    return sessions


# ── renderer ─────────────────────────────────────────────────────────────────

def compute_session_volume(exercises: list) -> int:
    total = 0
    for ex in exercises:
        if ex.get("is_cardio"):
            continue
        if ex.get("total_volume"):
            try:
                total += int(ex["total_volume"])
            except ValueError:
                pass
        else:
            for s in ex.get("sets", []):
                try:
                    total += float(s["weight"]) * float(s["reps"])
                except (ValueError, KeyError):
                    pass
    return int(total)


def render(sessions: list[Session]) -> str:
    lines = []
    for sess in sessions:
        dur_min = parse_duration_to_minutes(sess.duration_raw) if sess.duration_raw else "null"
        sv = compute_session_volume(sess.exercises)

        lines.append("SESSION:")
        lines.append(f"  date: {sess.date}")
        lines.append(f"  duration_minutes: {dur_min}")
        lines.append(f"  bodyweight_lbs: {sess.bodyweight or 'null'}")
        lines.append(f"  total_session_volume_lbs: {sv}")

        if not sess.exercises:
            lines.append("  EXERCISES: []")
            lines.append("")
            continue

        lines.append("  EXERCISES:")

        for ex in sess.exercises:
            name = ex["name"].replace("🏃 ", "").strip()

            if ex.get("is_cardio"):
                dur_s = ex.get("duration_seconds", "null")
                lines.append(f"    - name: {name}")
                lines.append(f"      type: cardio")
                lines.append(f"      duration_seconds: {dur_s}")
                continue

            ex_vol = ex.get("total_volume") or "null"
            lines.append(f"    - name: {name}")
            lines.append(f"      total_volume_lbs: {ex_vol}")

            if not ex["sets"]:
                lines.append("      sets: []")
                continue

            lines.append("      sets:")
            for s in ex["sets"]:
                rir_part = f", rir: {s['rir']}" if "rir" in s else ""
                lines.append(
                    f"        - {{weight: {s['weight']}, reps: {s['reps']}, type: {s['type']}{rir_part}}}"
                )

        lines.append("")

    return "\n".join(lines)


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"Parsing {INPUT} ...")
    sessions = parse_markdown(INPUT)
    print(f"  → {len(sessions)} sessions found")

    output = render(sessions)
    Path(OUTPUT).write_text(output, encoding="utf-8")

    print(f"Written to {OUTPUT}")
    print(f"Output size: {len(output):,} chars  ({Path(OUTPUT).stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
