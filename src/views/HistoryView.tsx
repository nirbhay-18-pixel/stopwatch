import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { useNav } from "../state/nav";
import { Btn, Confirm, EmptyState, Field, I, Modal } from "../components/ui";
import {
  MODE_LABEL,
  clampInt,
  dayKey,
  fmtDate,
  fmtDateLong,
  fmtDur,
  fmtDurLong,
  fmtTime,
  fromLocalInput,
  isToday,
  msToHMS,
  sessionMatches,
  startOfMonth,
  startOfWeek,
  toLocalInput,
  type Mode,
  type Session,
  type TimerType,
} from "../lib/core";

type ModeFilter = "all" | Mode;
type RangeFilter = "all" | "today" | "week" | "month";

const MODE_CHIPS: Array<{ v: ModeFilter; label: string }> = [
  { v: "all", label: "All" },
  { v: "study", label: "Study" },
  { v: "other", label: "Other" },
];
const RANGE_CHIPS: Array<{ v: RangeFilter; label: string }> = [
  { v: "all", label: "All time" },
  { v: "today", label: "Today" },
  { v: "week", label: "This week" },
  { v: "month", label: "This month" },
];

export function HistoryView() {
  const { sessions, deleteSession } = useApp();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [modeF, setModeF] = useState<ModeFilter>("all");
  const [rangeF, setRangeF] = useState<RangeFilter>("all");
  const [editing, setEditing] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const query = q.trim().toLowerCase();
    return sessions.filter((s) => {
      if (modeF !== "all" && s.mode !== modeF) return false;
      if (rangeF === "today" && !isToday(s.startedAt, now)) return false;
      if (rangeF === "week" && s.startedAt < startOfWeek(now)) return false;
      if (rangeF === "month" && s.startedAt < startOfMonth(now)) return false;
      if (query && !sessionMatches(s, query)) return false;
      return true;
    });
  }, [sessions, q, modeF, rangeF]);

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const k = dayKey(s.startedAt);
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const totalMs = filtered.reduce((a, s) => a + s.duration, 0);
  const hasAny = sessions.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[22px] tracking-tight leading-none">History</h1>
          <p className="text-[13px] text-mut mt-1.5">Every saved session, exact to the second.</p>
        </div>
      </header>

      {/* toolbar */}
      <section className="card p-3.5 space-y-3" aria-label="History filters">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mut pointer-events-none">
            <I n="search" className="h-[18px] w-[18px]" />
          </span>
          <input
            className="input pl-10"
            placeholder="Search topic, task or subject — try “Vector”"
            aria-label="Search sessions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="icon-btn absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setQ("")} aria-label="Clear search">
              <I n="x" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5" role="group" aria-label="Filter by mode">
            {MODE_CHIPS.map((c) => (
              <button key={c.v} className={modeF === c.v ? "chip-on" : "chip-off"} aria-pressed={modeF === c.v} onClick={() => setModeF(c.v)}>
                {c.label}
              </button>
            ))}
          </div>
          <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter by period">
            {RANGE_CHIPS.map((c) => (
              <button key={c.v} className={rangeF === c.v ? "chip-on" : "chip-off"} aria-pressed={rangeF === c.v} onClick={() => setRangeF(c.v)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="text-[13px] text-mut px-1" aria-live="polite">
        {filtered.length > 0 ? (
          <>
            <strong className="text-ink font-mono">{filtered.length}</strong> session{filtered.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-ink font-mono">{fmtDur(totalMs)}</strong> total
          </>
        ) : hasAny ? (
          "No sessions match the current filters."
        ) : (
          "Your saved sessions will appear here."
        )}
      </p>

      {!hasAny ? (
        <section className="card">
          <EmptyState
            icon="history"
            title="No sessions yet"
            body="Start your first activity to begin building your history. Each session records its exact start, stop and duration."
          >
            <Btn variant="primary" icon="play" onClick={() => nav.go("timer")}>
              Start your first session
            </Btn>
          </EmptyState>
        </section>
      ) : filtered.length === 0 ? (
        <section className="card">
          <EmptyState
            icon="search"
            title={q ? `No matches for “${q.trim()}”` : "Nothing in this view"}
            body="Try a different search term or widen the filters to see more of your history."
          >
            <Btn
              variant="soft"
              icon="rotate"
              onClick={() => {
                setQ("");
                setModeF("all");
                setRangeF("all");
              }}
            >
              Clear filters
            </Btn>
          </EmptyState>
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, list]) => {
            const dayTotal = list.reduce((a, s) => a + s.duration, 0);
            return (
              <section key={key} aria-label={fmtDateLong(list[0].startedAt)}>
                <header className="flex items-baseline justify-between gap-3 px-1 mb-2">
                  <h2 className="font-display font-bold text-[14.5px] tracking-tight">
                    {fmtDateLong(list[0].startedAt)}
                    {isToday(list[0].startedAt, Date.now()) && <span className="text-pine"> · today</span>}
                  </h2>
                  <p className="font-mono text-[12px] text-mut tabular shrink-0">
                    {list.length} session{list.length === 1 ? "" : "s"} · {fmtDur(dayTotal)}
                  </p>
                </header>
                <ul className="space-y-2.5">
                  {list.map((s) => (
                    <li key={s.id} className="card p-4 hover:border-mut/45 transition-colors group">
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`shrink-0 h-9 w-9 rounded-lg grid place-items-center mt-0.5 ${
                            s.mode === "study" ? "bg-study/12 text-study" : "bg-other/12 text-other"
                          }`}
                          title={MODE_LABEL[s.mode]}
                        >
                          <I n={s.mode === "study" ? "book" : "shapes"} className="h-[18px] w-[18px]" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-[14.5px] leading-tight">{s.category}</h3>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-[0.12em] rounded px-1.5 py-0.5 ${
                                s.mode === "study" ? "text-study bg-study/10" : "text-other bg-other/10"
                              }`}
                            >
                              {MODE_LABEL[s.mode]}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] rounded px-1.5 py-0.5 text-mut bg-raise inline-flex items-center gap-1">
                              <I n={s.timerType === "countdown" ? "hourglass" : "timer"} className="h-3 w-3" />
                              {s.timerType === "countdown" ? "Countdown" : "Stopwatch"}
                            </span>
                          </div>
                          {(s.topic || s.task) && (
                            <p className="text-[13px] text-mut mt-0.5 truncate">
                              {s.topic && <span className="font-semibold text-ink/80">{s.topic}</span>}
                              {s.topic && s.task && <span className="mx-1">→</span>}
                              {s.task}
                            </p>
                          )}
                          <p className="font-mono text-[11.5px] text-mut tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>
                              <span className="text-mut/80">start</span> {fmtTime(s.startedAt)}
                            </span>
                            <span>
                              <span className="text-mut/80">stop</span> {fmtTime(s.endedAt)}
                            </span>
                            <span>{fmtDate(s.startedAt)}</span>
                            {s.pausedMs > 1000 && <span className="text-study">paused {fmtDur(s.pausedMs)}</span>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <p className="font-mono font-extrabold text-[16px] tabular leading-none">{fmtDur(s.duration)}</p>
                          <div className="flex gap-1">
                            <button type="button" className="icon-btn h-8 w-8" onClick={() => setEditing(s)} aria-label={`Edit ${s.category} session`}>
                              <I n="pencil" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="icon-btn h-8 w-8 hover:text-danger"
                              onClick={() => setDeleting(s)}
                              aria-label={`Delete ${s.category} session`}
                            >
                              <I n="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {editing && <EditSessionModal session={editing} onClose={() => setEditing(null)} />}

      <Confirm
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteSession(deleting.id);
        }}
        title="Delete this session?"
        body={
          deleting && (
            <>
              <strong className="text-ink">{deleting.category}</strong>
              {deleting.topic && <> · {deleting.topic}</>}
              {deleting.task && <> · {deleting.task}</>} — {fmtDurLong(deleting.duration)} on {fmtDate(deleting.startedAt)}. This
              can&rsquo;t be undone.
            </>
          )
        }
        confirmLabel="Delete session"
      />
    </div>
  );
}

/* ------------------------------ edit modal -------------------------------- */
function EditSessionModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const { categories, updateSession } = useApp();
  const [mode, setMode] = useState<Mode>(session.mode);
  const [category, setCategory] = useState(session.category);
  const [topic, setTopic] = useState(session.topic);
  const [task, setTask] = useState(session.task);
  const [timerType, setTimerType] = useState<TimerType>(session.timerType);
  const [startStr, setStartStr] = useState(() => toLocalInput(session.startedAt));
  const dur = msToHMS(session.duration);
  const [dh, setDh] = useState(String(dur.h));
  const [dm, setDm] = useState(String(dur.m));
  const [ds, setDs] = useState(String(dur.s));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const list = categories.filter((c) => c.mode === mode);
  const hasCat = list.some((c) => c.name === category);

  const save = async () => {
    const startedAt = fromLocalInput(startStr);
    if (startedAt == null) {
      setError("Enter a valid start date and time.");
      return;
    }
    const duration = (clampInt(dh, 0, 99) * 3600 + clampInt(dm, 0, 59) * 60 + clampInt(ds, 0, 59)) * 1000;
    if (duration <= 0) {
      setError("Duration must be at least one second.");
      return;
    }
    if (!category.trim()) {
      setError("A subject or category is required.");
      return;
    }
    setBusy(true);
    try {
      await updateSession({
        ...session,
        mode,
        category: category.trim(),
        topic: topic.trim(),
        task: task.trim(),
        timerType,
        startedAt,
        endedAt: startedAt + duration + session.pausedMs,
        duration,
      });
      onClose();
    } catch {
      setError("Saving failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Edit session"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" icon="check" disabled={busy} onClick={() => void save()}>
            Save changes
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Mode" htmlFor="edit-mode">
            <div className="relative">
              <select
                id="edit-mode"
                className="input appearance-none pr-9 cursor-pointer font-semibold"
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as Mode;
                  setMode(m);
                  const first = categories.find((c) => c.mode === m);
                  setCategory(first?.name ?? "");
                }}
              >
                <option value="study">Study</option>
                <option value="other">Other</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none">
                <I n="chevronDown" className="h-4 w-4" />
              </span>
            </div>
          </Field>
          <Field label={mode === "study" ? "Subject" : "Category"} htmlFor="edit-cat">
            <div className="relative">
              <select
                id="edit-cat"
                className="input appearance-none pr-9 cursor-pointer font-semibold"
                value={hasCat ? category : category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {!hasCat && <option value={category}>{category}</option>}
                {list.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none">
                <I n="chevronDown" className="h-4 w-4" />
              </span>
            </div>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Topic" htmlFor="edit-topic">
            <input id="edit-topic" className="input" value={topic} maxLength={60} onChange={(e) => setTopic(e.target.value)} />
          </Field>
          <Field label="Task" htmlFor="edit-task">
            <input id="edit-task" className="input" value={task} maxLength={60} onChange={(e) => setTask(e.target.value)} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Started at" htmlFor="edit-start" hint="Local timezone — seconds included.">
            <input id="edit-start" type="datetime-local" step={1} className="input font-mono" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
          </Field>
          <Field label="Timer type" htmlFor="edit-timer">
            <div className="relative">
              <select
                id="edit-timer"
                className="input appearance-none pr-9 cursor-pointer font-semibold"
                value={timerType}
                onChange={(e) => setTimerType(e.target.value as TimerType)}
              >
                <option value="stopwatch">Stopwatch</option>
                <option value="countdown">Countdown</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none">
                <I n="chevronDown" className="h-4 w-4" />
              </span>
            </div>
          </Field>
        </div>
        <Field label="Duration" hint="End time is recalculated as start + duration.">
          <div className="grid grid-cols-3 gap-2.5">
            <label className="block">
              <span className="text-[11px] font-bold text-mut">HOURS</span>
              <input className="input font-mono font-bold text-center mt-1" inputMode="numeric" value={dh}
                onChange={(e) => setDh(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setDh(String(clampInt(dh, 0, 99)))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-mut">MINUTES</span>
              <input className="input font-mono font-bold text-center mt-1" inputMode="numeric" value={dm}
                onChange={(e) => setDm(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setDm(String(clampInt(dm, 0, 59)))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-mut">SECONDS</span>
              <input className="input font-mono font-bold text-center mt-1" inputMode="numeric" value={ds}
                onChange={(e) => setDs(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setDs(String(clampInt(ds, 0, 59)))} />
            </label>
          </div>
        </Field>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-[13px] font-semibold text-danger">
            <I n="alert" className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
