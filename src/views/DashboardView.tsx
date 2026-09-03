import { useMemo } from "react";
import { useApp, useNow } from "../state/AppContext";
import { useNav } from "../state/nav";
import { Btn, EmptyState, I, type IconName } from "../components/ui";
import {
  fmtDateLong,
  fmtDur,
  fmtTime,
  getElapsed,
  isToday,
  msToHMS,
  type Session,
} from "../lib/core";

const sum = (list: Session[]) => list.reduce((a, s) => a + s.duration, 0);

function MiniStat({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/70 px-4 py-3 min-w-[118px] flex-1">
      <p className="tick-label flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </p>
      <p className="mt-1.5 font-mono font-extrabold text-[19px] tabular leading-none">{value}</p>
    </div>
  );
}

function BreakdownGroup({
  title,
  icon,
  accent,
  barClass,
  sessions,
}: {
  title: string;
  icon: IconName;
  accent: string;
  barClass: string;
  sessions: Session[];
}) {
  const rows = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.category, (map.get(s.category) ?? 0) + s.duration);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [sessions]);
  const max = rows[0]?.[1] ?? 0;

  return (
    <div>
      <p className={`tick-label mb-2.5 flex items-center gap-1.5 ${accent}`}>
        <I n={icon} className="h-3.5 w-3.5" />
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-mut py-2">Nothing tracked here today.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(([name, ms], i) => (
            <li key={name} className="flex items-center gap-3">
              <span className="w-[104px] sm:w-[128px] truncate text-[13px] font-semibold">{name}</span>
              <span className="flex-1 h-2 rounded-full bg-raise overflow-hidden">
                <span
                  className={`block h-full rounded-full ${barClass} animate-growX`}
                  style={{ width: `${max > 0 ? Math.max(4, (ms / max) * 100) : 0}%`, animationDelay: `${i * 60}ms` }}
                />
              </span>
              <span className="w-[62px] text-right font-mono text-[12.5px] font-bold tabular">{fmtDur(ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardView() {
  const { sessions, activeTimer } = useApp();
  const nav = useNav();
  const now = useNow(activeTimer !== null);
  const today = useMemo(() => sessions.filter((s) => isToday(s.startedAt, now)), [sessions, now]);

  const todayMs = sum(today);
  const studyToday = today.filter((s) => s.mode === "study");
  const otherToday = today.filter((s) => s.mode === "other");
  const allMs = useMemo(() => sum(sessions), [sessions]);
  const { h, m } = msToHMS(todayMs);

  const timeline = useMemo(() => [...today].sort((a, b) => a.startedAt - b.startedAt), [today]);
  const liveElapsed = activeTimer ? getElapsed(activeTimer, now) : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[22px] tracking-tight leading-none">Dashboard</h1>
          <p className="text-[13px] text-mut mt-1.5">{fmtDateLong(now)}</p>
        </div>
        <Btn variant="primary" size="sm" icon="play" onClick={() => nav.go("timer")}>
          Start a session
        </Btn>
      </header>

      {/* hero: today */}
      <section className="card relative overflow-hidden p-5 sm:p-6" aria-label="Today summary">
        <div
          className="absolute -top-16 -right-10 h-52 w-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgb(var(--pine) / 0.14), transparent 65%)" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
          <div className="flex-1">
            <p className="tick-label">Today · total tracked</p>
            <p className="mt-2 font-mono font-extrabold tabular text-[46px] sm:text-[58px] leading-none tracking-[-0.02em]">
              {h}
              <span className="text-[0.55em] font-bold text-mut ml-1">h</span>
              {String(m).padStart(2, "0")}
              <span className="text-[0.55em] font-bold text-mut ml-1">m</span>
            </p>
            <p className="mt-2.5 text-[13.5px] text-mut">
              <strong className="text-ink font-mono">{today.length}</strong> session{today.length === 1 ? "" : "s"} today
              {today.length > 0 && (
                <>
                  {" "}
                  · avg <strong className="text-ink font-mono">{fmtDur(todayMs / today.length)}</strong>
                </>
              )}
              {activeTimer && (
                <>
                  {" "}
                  · <span className="text-pine font-semibold">one running now</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <MiniStat label="Study" value={fmtDur(sum(studyToday))} dot="bg-study" />
            <MiniStat label="Other" value={fmtDur(sum(otherToday))} dot="bg-other" />
            <MiniStat label="All time" value={fmtDur(allMs)} dot="bg-pine" />
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-5 items-start">
        {/* breakdown */}
        <section className="card p-5" aria-label="Today breakdown">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">Today by subject</h2>
          {today.length === 0 ? (
            <p className="text-[13px] text-mut">
              Your per-subject breakdown appears here after the first session of the day.
            </p>
          ) : (
            <div className="space-y-6">
              <BreakdownGroup title="Study" icon="book" accent="text-study" barClass="bg-study" sessions={studyToday} />
              <BreakdownGroup title="Other" icon="shapes" accent="text-other" barClass="bg-other" sessions={otherToday} />
            </div>
          )}
        </section>

        {/* timeline */}
        <section className="card p-5" aria-label="Today timeline">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">Today&rsquo;s timeline</h2>
          {timeline.length === 0 && !activeTimer ? (
            <EmptyState
              icon="calendar"
              title="Nothing on the timeline yet"
              body="Start your first activity and the day will map itself here, minute by minute."
            >
              <Btn variant="primary" size="sm" icon="timer" onClick={() => nav.go("timer")}>
                Open the timer
              </Btn>
            </EmptyState>
          ) : (
            <ol>
              {timeline.map((s, i) => (
                <li key={s.id} className="flex gap-3.5">
                  <span className="flex flex-col items-center">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full border-2 shrink-0 ${s.mode === "study" ? "border-study" : "border-other"} bg-surface`} />
                    {i < timeline.length - 1 || activeTimer ? <span className="w-px flex-1 bg-line my-1" /> : null}
                  </span>
                  <div className="pb-5 min-w-0 flex-1">
                    <p className="font-mono text-[11.5px] text-mut tabular">{fmtTime(s.startedAt)}</p>
                    <p className="text-[13.5px] font-semibold truncate">
                      {s.category}
                      {s.topic && <span className="text-mut font-normal"> · {s.topic}</span>}
                      {s.task && <span className="text-mut font-normal"> · {s.task}</span>}
                    </p>
                    <p className="text-[12px] text-mut mt-0.5">
                      <span className="font-mono font-bold text-ink">{fmtDur(s.duration)}</span>
                      {s.timerType === "countdown" && " · countdown"}
                      {s.pausedMs > 1000 && ` · paused ${fmtDur(s.pausedMs)}`}
                    </p>
                  </div>
                </li>
              ))}
              {activeTimer && (
                <li className="flex gap-3.5">
                  <span className="flex flex-col items-center">
                    <span className="mt-1 relative flex h-2.5 w-2.5 shrink-0">
                      <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pine" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11.5px] text-pine font-bold">now</p>
                    <p className="text-[13.5px] font-semibold truncate">
                      {activeTimer.category}
                      {activeTimer.topic && <span className="text-mut font-normal"> · {activeTimer.topic}</span>}
                      {activeTimer.task && <span className="text-mut font-normal"> · {activeTimer.task}</span>}
                    </p>
                    <p className="text-[12px] text-mut mt-0.5">
                      <span className="font-mono font-bold text-pine">{fmtDur(liveElapsed)}</span> in progress
                    </p>
                  </div>
                </li>
              )}
            </ol>
          )}
        </section>
      </div>

      {sessions.length === 0 && (
        <section className="card">
          <EmptyState
            icon="timer"
            title="No sessions yet"
            body="Start your first activity to begin building your history. Everything is stored on this device — no account, no internet."
          >
            <Btn variant="primary" icon="play" onClick={() => nav.go("timer")}>
              Start your first session
            </Btn>
          </EmptyState>
        </section>
      )}
    </div>
  );
}
