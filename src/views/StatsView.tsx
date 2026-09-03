import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { useNav } from "../state/nav";
import { Btn, EmptyState } from "../components/ui";
import {
  dayKey,
  fmtDate,
  fmtDayShort,
  fmtDur,
  isToday,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Mode,
  type Session,
} from "../lib/core";

type Period = "today" | "yesterday" | "week" | "month" | "all";

const PERIODS: Array<{ v: Period; label: string }> = [
  { v: "today", label: "Today" },
  { v: "yesterday", label: "Yesterday" },
  { v: "week", label: "This week" },
  { v: "month", label: "This month" },
  { v: "all", label: "All time" },
];

function inPeriod(s: Session, p: Period, now: number): boolean {
  switch (p) {
    case "today":
      return isToday(s.startedAt, now);
    case "yesterday":
      return isYesterday(s.startedAt, now);
    case "week":
      return s.startedAt >= startOfWeek(now);
    case "month":
      return s.startedAt >= startOfMonth(now);
    default:
      return true;
  }
}

export function StatsView() {
  const { sessions } = useApp();
  const nav = useNav();
  const [period, setPeriod] = useState<Period>("week");
  const now = Date.now();

  const list = useMemo(() => sessions.filter((s) => inPeriod(s, period, now)), [sessions, period, now]);

  const total = list.reduce((a, s) => a + s.duration, 0);
  const count = list.length;
  const avg = count > 0 ? total / count : 0;
  const longest = list.reduce<Session | null>((best, s) => (best == null || s.duration > best.duration ? s : best), null);

  const breakdown = useMemo(() => {
    const map = new Map<string, { name: string; mode: Mode; ms: number }>();
    for (const s of list) {
      const k = `${s.mode}|${s.category}`;
      const cur = map.get(k);
      if (cur) cur.ms += s.duration;
      else map.set(k, { name: s.category, mode: s.mode, ms: s.duration });
    }
    return [...map.values()].sort((a, b) => b.ms - a.ms).slice(0, 10);
  }, [list]);
  const maxCat = breakdown[0]?.ms ?? 0;

  /* last 14 days, independent of the selected period */
  const days = useMemo(() => {
    const base = startOfDay(now);
    const out: Array<{ ts: number; ms: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const ts = base - i * 86_400_000;
      const key = dayKey(ts);
      out.push({ ts, ms: sessions.reduce((a, s) => (dayKey(s.startedAt) === key ? a + s.duration : a), 0) });
    }
    return out;
  }, [sessions, now]);
  const maxDay = Math.max(...days.map((d) => d.ms), 0);
  const weekTotal = days.slice(7).reduce((a, d) => a + d.ms, 0);

  const periodLabel = PERIODS.find((p) => p.v === period)?.label ?? "";

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[22px] tracking-tight leading-none">Statistics</h1>
          <p className="text-[13px] text-mut mt-1.5">Where your hours actually went.</p>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Statistics period">
        {PERIODS.map((p) => (
          <button key={p.v} className={period === p.v ? "chip-on" : "chip-off"} aria-pressed={period === p.v} onClick={() => setPeriod(p.v)}>
            {p.label}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <section className="card">
          <EmptyState
            icon="chart"
            title="No data to chart yet"
            body="Once you save sessions, totals, averages and per-subject breakdowns will build themselves here."
          >
            <Btn variant="primary" icon="play" onClick={() => nav.go("timer")}>
              Track your first session
            </Btn>
          </EmptyState>
        </section>
      ) : (
        <>
          {/* tiles */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label={`${periodLabel} summary`}>
            <div className="card p-4">
              <p className="tick-label">Total · {periodLabel}</p>
              <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{fmtDur(total)}</p>
            </div>
            <div className="card p-4">
              <p className="tick-label">Sessions</p>
              <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{count}</p>
            </div>
            <div className="card p-4">
              <p className="tick-label">Avg session</p>
              <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{count > 0 ? fmtDur(avg) : "—"}</p>
            </div>
            <div className="card p-4">
              <p className="tick-label">Longest</p>
              <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{longest ? fmtDur(longest.duration) : "—"}</p>
              {longest && <p className="text-[11.5px] text-mut mt-1 truncate">{longest.category}{longest.topic && ` · ${longest.topic}`}</p>}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-5 items-start">
            {/* breakdown */}
            <section className="card p-5" aria-label="Breakdown by subject and category">
              <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">By subject &amp; category</h2>
              <p className="text-[12.5px] text-mut mb-4">{periodLabel}</p>
              {breakdown.length === 0 ? (
                <p className="text-[13px] text-mut py-2">No sessions in this period.</p>
              ) : (
                <ul className="space-y-2.5">
                  {breakdown.map((b, i) => (
                    <li key={`${b.mode}|${b.name}`} className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${b.mode === "study" ? "bg-study" : "bg-other"}`} title={b.mode === "study" ? "Study" : "Other"} />
                      <span className="w-[104px] sm:w-[124px] truncate text-[13px] font-semibold">{b.name}</span>
                      <span className="flex-1 h-2.5 rounded-full bg-raise overflow-hidden">
                        <span
                          className={`block h-full rounded-full animate-growX ${b.mode === "study" ? "bg-study" : "bg-other"}`}
                          style={{ width: `${maxCat > 0 ? Math.max(4, (b.ms / maxCat) * 100) : 0}%`, animationDelay: `${i * 50}ms` }}
                        />
                      </span>
                      <span className="w-[64px] text-right font-mono text-[12.5px] font-bold tabular">{fmtDur(b.ms)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[11.5px] text-mut flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-study" /> Study</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-other" /> Other</span>
              </p>
            </section>

            {/* daily chart */}
            <section className="card p-5" aria-label="Daily time, last 14 days">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display font-bold text-[16px] tracking-tight">Daily time</h2>
                  <p className="text-[12.5px] text-mut">Last 14 days</p>
                </div>
                <p className="text-[12px] text-mut text-right">
                  peak <strong className="text-ink font-mono">{fmtDur(maxDay)}</strong>
                  <span className="block">
                    last 7d <strong className="text-ink font-mono">{fmtDur(weekTotal)}</strong>
                  </span>
                </p>
              </div>
              <div
                className="h-36 flex items-end gap-[5px]"
                role="img"
                aria-label={`Bar chart of tracked time per day over the last 14 days. Peak day ${fmtDur(maxDay)}.`}
              >
                {days.map((d) => {
                  const today = isToday(d.ts, now);
                  const pct = maxDay > 0 ? (d.ms / maxDay) * 100 : 0;
                  return (
                    <div
                      key={d.ts}
                      className="flex-1 h-full flex flex-col justify-end group cursor-default"
                      title={`${fmtDate(d.ts)} — ${fmtDur(d.ms)}`}
                    >
                      <div
                        className={`rounded-t-[4px] transition-all duration-200 group-hover:brightness-110 ${
                          d.ms === 0 ? "bg-line" : today ? "bg-pine" : "bg-pine/35 group-hover:bg-pine/55"
                        }`}
                        style={{ height: d.ms === 0 ? "3px" : `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-[5px] mt-1.5">
                {days.map((d) => (
                  <span key={d.ts} className={`flex-1 text-center font-mono text-[9.5px] ${isToday(d.ts, now) ? "text-pine font-bold" : "text-mut"}`}>
                    {new Date(d.ts).getDate()}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] text-mut">{fmtDayShort(now)} {new Date(now).getDate()} is today — bars show total tracked per day.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
