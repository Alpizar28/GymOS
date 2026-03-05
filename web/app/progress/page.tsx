"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type CalendarDay } from "@/lib/api";
import { FlameIcon } from "@/components/icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateFromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dayDiff(a: Date, b: Date) {
  const ms = 1000 * 60 * 60 * 24;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / ms);
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function computeStreaks(workoutKeys: string[], today: Date) {
  const dates = [...new Set(workoutKeys)].sort().map(localDateFromKey);
  if (dates.length === 0) {
    return { current: 0, longest: 0 };
  }

  let current = 0;
  const last = dates[dates.length - 1];
  if (dayDiff(today, last) <= 2) {
    current = 1;
    for (let i = dates.length - 1; i > 0; i -= 1) {
      const gap = dayDiff(dates[i], dates[i - 1]);
      if (gap <= 3) current += 1;
      else break;
    }
  }

  let run = 1;
  let longest = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const gap = dayDiff(dates[i], dates[i - 1]);
    if (gap <= 3) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  return { current, longest };
}

export default function ProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState("");

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const seasonStart = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);
  const seasonEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calendarDays = await api.getCalendar(formatISO(seasonStart), formatISO(seasonEnd));
      setDays(calendarDays);
    } finally {
      setLoading(false);
    }
  }, [seasonStart, seasonEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const workoutSet = useMemo(() => {
    const set = new Set<string>();
    for (const day of days) {
      if (day.workouts.length > 0) set.add(day.date);
    }
    return set;
  }, [days]);

  const streak = useMemo(() => computeStreaks([...workoutSet], today), [workoutSet, today]);

  const months = useMemo(() => {
    const result: { key: string; label: string; cells: (Date | null)[] }[] = [];
    for (let month = 0; month <= today.getMonth(); month += 1) {
      result.push({
        key: `${today.getFullYear()}-${month}`,
        label: monthLabel(today.getFullYear(), month),
        cells: buildMonthCells(today.getFullYear(), month),
      });
    }
    return result;
  }, [today]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    const text = `GymOS Streak\nCurrent: ${streak.current}\nLongest: ${streak.longest}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "GymOS Streak", text });
      } else {
        await navigator.clipboard.writeText(text);
        setToast("Streak copied");
        window.setTimeout(() => setToast(""), 1800);
      }
    } catch {
      // User cancelled share, no action needed.
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full border border-zinc-800">
          ←
        </button>
        <h1 className="text-xl font-bold">Streaks</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => void load()} className="w-10 h-10 rounded-full border border-zinc-800">
            ⟳
          </button>
          <button onClick={() => void handleShare()} className="w-10 h-10 rounded-full border border-zinc-800">
            ⤴
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-600/25 to-red-500/10 p-5 mb-4">
        <div className="flex items-start justify-between">
          <p className="text-6xl leading-none font-black text-white">{streak.current}</p>
          <FlameIcon className="h-8 w-8 text-red-300" />
        </div>
        <p className="text-base font-semibold mt-2 text-red-100">current streak!</p>
        <p className="text-xs text-red-200/80 mt-1">Longest: {streak.longest}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-sm font-semibold mb-3">Season Calendar</h2>

        {loading ? (
          <div className="py-10 text-center text-zinc-500 text-sm">Loading season...</div>
        ) : (
          <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
            {months.map((month) => (
              <div key={month.key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs font-semibold text-zinc-300 mb-2">{month.label}</p>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((day) => (
                    <p key={`${month.key}-${day}`} className="text-[10px] text-zinc-500 text-center">
                      {day}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {month.cells.map((cell, idx) => {
                    if (!cell) return <div key={`${month.key}-empty-${idx}`} className="h-8" />;

                    const key = formatISO(cell);
                    const isWorkout = workoutSet.has(key);
                    const isToday = dayDiff(cell, today) === 0;
                    const isFuture = dayDiff(cell, today) > 0;

                    let className = "h-8 w-8 rounded-full flex items-center justify-center text-[11px] border ";
                    let content: string = String(cell.getDate());

                    if (isWorkout && isToday) {
                      className += "bg-red-500 border-red-300 text-red-950 ring-2 ring-red-300/60";
                      content = "W";
                    } else if (isWorkout) {
                      className += "bg-red-500/80 border-red-400 text-red-950";
                      content = "W";
                    } else if (isToday) {
                      className += "bg-zinc-900 border-red-500 text-red-300";
                    } else if (isFuture) {
                      className += "bg-zinc-900 border-zinc-800 text-zinc-600";
                    } else {
                      className += "bg-zinc-800 border-zinc-700 text-zinc-300";
                    }

                    return (
                      <div key={`${month.key}-${key}`} className="flex items-center justify-center">
                        <span className={className}>{content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
