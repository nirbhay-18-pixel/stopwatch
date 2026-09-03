import { useEffect, useMemo, useState } from "react";
import { useApp, useNow } from "../state/AppContext";
import { useNav } from "../state/nav";
import { CategoryPicker } from "../components/CategoryPicker";
import { Btn, Confirm, Field, I, Segmented } from "../components/ui";
import {
  MODE_LABEL,
  clampInt,
  fmtClock,
  fmtDate,
  fmtDur,
  fmtDurLong,
  fmtTime,
  getElapsed,
  msToHMS,
  pad2,
  type ActiveTimer,
  type Lap,
  type Mode,
  type TimerType,
} from "../lib/core";

const LCD = "#9ef0d2";
const LCD_PAUSED = "#eec27a";
const LCD_DANGER = "#ff9d8b";
const LCD_DIM = "#5b8a74";

function ClockDigits({ ms, running, color }: { ms: number; running: boolean; color: string }) {
  const { h, m, s } = msToHMS(ms);
  return (
    <div
      role="timer"
      aria-label={fmtDurLong(ms)}
      className={`font-mono font-extrabold tabular leading-none tracking-[-0.03em] text-[52px] sm:text-[72px] flex items-baseline justify-center ${running ? "lcd-run" : ""}`}
      style={{ color }}
    >
      <span>{pad2(Math.min(h, 99))}</span>
      <span className={`px-[0.12em] ${running ? "colon-run" : ""}`} style={{ color: LCD_DIM }}>
        :
      </span>
      <span>{pad2(m)}</span>
      <span className={`px-[0.12em] ${running ? "colon-run" : ""}`} style={{ color: LCD_DIM }}>
        :
      </span>
      <span>{pad2(s)}</span>
    </div>
  );
}

/** Big, touch-friendly lap/split button — pine "flag" treatment. */
function LapButton({
  onLap,
  enabled,
  nextLap,
}: {
  onLap: () => void;
  enabled: boolean;
  nextLap: number;
}) {
  return (
    <button
      type="button"
      onClick={onLap}
      disabled={!enabled}
      aria-label={enabled ? `Record lap ${nextLap}` : "Lap is only available while the timer is running"}
      title={enabled ? `Record lap ${nextLap}` : "Resume the timer to record laps"}
      className="btn w-full h-[52px] px-6 text-[15px] rounded-xl border border-pine/45 bg-pine/8 text-pine hover:bg-pine/14 active:bg-pine/20"
    >
      <I n="flag" className="h-[18px] w-[18px]" />
      Lap
      {nextLap > 1 && (
        <span className="font-mono text-[12px] font-bold tabular rounded-md px-1.5 py-0.5 bg-pine/15">
          #{nextLap}
        </span>
      )}
    </button>
  );
}

/** Live lap history — newest first, instrument-styled like the LCD screen. */
function LapPanel({ timer, laps, now }: { timer: ActiveTimer; laps: Lap[]; now: number }) {
  const newest = laps[laps.length - 1];
  const running = timer.status === "running";
  const lastTotal = newest?.totalElapsed ?? 0;
  const liveLap = Math.max(0, getElapsed(timer, now) - lastTotal);
  return (
    <div
      className="mx-4 mb-4 rounded-xl border border-screenline bg-screen overflow-hidden"
      style={{ boxShadow: "inset 0 2px 12px rgba(0,0,0,0.45)" }}
      aria-label="Lap history"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <span
          className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em]"
          style={{ color: LCD }}
        >
          <I n="flag" className="h-3.5 w-3.5" />
          Lap history
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] leading-none tabular"
            style={{ background: "rgba(158,240,210,0.14)" }}
          >
            {laps.length}
          </span>
        </span>
        <span className="font-mono text-[11px] tabular" style={{ color: running ? LCD : LCD_PAUSED }}>
          {running ? (
            <>
              Lap {laps.length + 1} · {fmtClock(liveLap)}
            </>
          ) : (
            <>Lap {laps.length + 1} · paused</>
          )}
        </span>
      </div>
      <ul className="mt-2 max-h-[230px] overflow-y-auto">
        {[...laps].reverse().map((lap) => (
          <li
            key={lap.lapNumber}
            className="animate-pop flex items-center justify-between gap-3 px-4 py-2.5 border-t"
            style={{ borderColor: "rgba(158,240,210,0.07)" }}
          >
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] font-bold" style={{ color: LCD }}>
                Lap {lap.lapNumber}
              </p>
              <p className="font-mono text-[10.5px] mt-0.5 truncate" style={{ color: LCD_DIM }}>
                {fmtDate(lap.timestamp)} · {fmtTime(lap.timestamp)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-[14px] font-extrabold tabular leading-none" style={{ color: LCD }}>
                {fmtDur(lap.lapDuration)}
              </p>
              <p className="font-mono text-[10.5px] tabular mt-1" style={{ color: LCD_DIM }}>
                Total {fmtDur(lap.totalElapsed)}
                {lap.remaining != null && <> · {fmtDur(lap.remaining)} left</>}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {newest
          ? `Lap ${newest.lapNumber} recorded. Lap time ${fmtDurLong(newest.lapDuration)}, total ${fmtDurLong(newest.totalElapsed)}.`
          : ""}
      </p>
    </div>
  );
}

const PRESETS: Array<{ label: string; h: number; m: number }> = [
  { label: "25m", h: 0, m: 25 },
  { label: "50m", h: 0, m: 50 },
  { label: "1h", h: 1, m: 0 },
  { label: "1h 30m", h: 1, m: 30 },
];

export function TimerView() {
  const app = useApp();
  const nav = useNav();
  const { activeTimer, categories, ready } = app;

  const [mode, setMode] = useState<Mode>(app.settings.defaultMode);
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [task, setTask] = useState("");
  const [timerType, setTimerType] = useState<TimerType>(app.settings.defaultTimerType);
  const [cdH, setCdH] = useState("0");
  const [cdM, setCdM] = useState("25");
  const [cdS, setCdS] = useState("0");
  const [cdError, setCdError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const active = activeTimer !== null;
  const running = activeTimer?.status === "running";
  const now = useNow(active);

  /* keep a valid category selected whenever the list or mode changes */
  useEffect(() => {
    if (!ready) return;
    const list = categories.filter((c) => c.mode === mode);
    if (!list.some((c) => c.name === category)) setCategory(list[0]?.name ?? "");
  }, [ready, categories, mode, category]);

  const countdownMs =
    (clampInt(cdH, 0, 99) * 3600 + clampInt(cdM, 0, 59) * 60 + clampInt(cdS, 0, 59)) * 1000;

  const elapsed = activeTimer ? getElapsed(activeTimer, now) : 0;
  const laps = activeTimer?.laps ?? [];
  const displayIsCountdown = activeTimer ? activeTimer.timerType === "countdown" : timerType === "countdown";
  const totalMs = activeTimer ? activeTimer.countdownMs : countdownMs;
  const displayMs = activeTimer
    ? displayIsCountdown
      ? Math.max(0, totalMs - elapsed)
      : elapsed
    : displayIsCountdown
      ? countdownMs
      : 0;

  const lowTime = displayIsCountdown && active && totalMs > 0 && displayMs / totalMs <= 0.1;
  const digitColor = !active || !running ? (active ? LCD_PAUSED : LCD) : lowTime ? LCD_DANGER : LCD;

  const pausedSoFar = activeTimer ? Math.max(0, now - activeTimer.startedAt - elapsed) : 0;
  const endsAt = useMemo(() => {
    if (!activeTimer || activeTimer.timerType !== "countdown" || activeTimer.status !== "running" || activeTimer.resumeAt == null)
      return null;
    return activeTimer.resumeAt + (activeTimer.countdownMs - activeTimer.accumulatedMs);
  }, [activeTimer]);

  const handleStart = () => {
    if (timerType === "countdown" && countdownMs <= 0) {
      setCdError("Set a countdown longer than zero — hours, minutes or seconds.");
      return;
    }
    setCdError("");
    app.startTimer({ mode, category, topic, task, timerType, countdownMs });
  };

  const numInput = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  return (
    <div className="space-y-5">
      {/* Time's up banner */}
      {app.timesUp && (
        <div className="card border-study/45 overflow-hidden animate-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 p-4 sm:p-5" style={{ background: "rgb(var(--study) / 0.09)" }}>
            <span className="h-11 w-11 rounded-xl grid place-items-center text-study shrink-0" style={{ background: "rgb(var(--study) / 0.15)" }}>
              <I n="hourglass" className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-[16px]">Time&rsquo;s up!</p>
              <p className="text-[13.5px] text-mut leading-snug mt-0.5">
                <strong className="text-ink">{app.timesUp.category}</strong>
                {app.timesUp.topic && <> · {app.timesUp.topic}</>}
                {app.timesUp.task && <> · {app.timesUp.task}</>} ran for{" "}
                <strong className="text-ink font-mono">{fmtDur(app.timesUp.duration)}</strong> and was saved to History.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Btn size="sm" variant="soft" icon="history" onClick={() => nav.go("history")}>
                View history
              </Btn>
              <Btn size="sm" variant="ghost" onClick={app.dismissTimesUp}>
                Dismiss
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] gap-5 items-start">
        {/* ------------------------- LCD timer screen ------------------------- */}
        <section className="order-1 lg:order-2 card overflow-hidden" aria-label="Timer">
          <div
            className="relative mx-4 mt-4 rounded-xl border border-screenline bg-screen overflow-hidden"
            style={{ boxShadow: "inset 0 2px 18px rgba(0,0,0,0.55)" }}
          >
            {/* scanlines */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)" }}
            />
            <div className="relative p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: activeTimer?.mode === "other" ? "#7fd8c6" : "#f0b46a",
                    background: activeTimer?.mode === "other" ? "rgba(90,205,186,0.12)" : "rgba(233,163,82,0.12)",
                  }}
                >
                  <I n={activeTimer?.mode === "other" ? "shapes" : "book"} className="h-3.5 w-3.5" />
                  {MODE_LABEL[activeTimer?.mode ?? mode]}
                </span>
                <span className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: LCD_DIM }}>
                  {!active ? (
                    <>Ready · {displayIsCountdown ? "countdown" : "stopwatch"}</>
                  ) : running ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="pulse-dot absolute inline-flex h-full w-full rounded-full" style={{ background: LCD }} />
                        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: LCD }} />
                      </span>
                      Running
                    </>
                  ) : (
                    <>
                      <span className="inline-flex h-2 w-2 rounded-full" style={{ background: LCD_PAUSED }} />
                      Paused
                    </>
                  )}
                </span>
              </div>

              <p className="mt-4 text-center text-[13px] font-semibold truncate px-2" style={{ color: "#c8e9da" }}>
                {activeTimer ? (
                  <>
                    {activeTimer.category}
                    {activeTimer.topic && <span style={{ color: LCD_DIM }}> · {activeTimer.topic}</span>}
                    {activeTimer.task && <span style={{ color: LCD_DIM }}> · {activeTimer.task}</span>}
                  </>
                ) : (
                  <span style={{ color: LCD_DIM }}>
                    {category || "Pick a subject"}
                    {topic && ` · ${topic}`}
                    {task && ` · ${task}`}
                  </span>
                )}
              </p>

              <div className="mt-4 sm:mt-5">
                <ClockDigits ms={displayMs} running={Boolean(running)} color={digitColor} />
              </div>

              {active && displayIsCountdown && (
                <div className="mt-5">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(158,240,210,0.12)" }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-linear"
                      style={{
                        width: `${totalMs > 0 ? (displayMs / totalMs) * 100 : 0}%`,
                        background: lowTime ? LCD_DANGER : LCD,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] font-mono" style={{ color: LCD_DIM }}>
                    <span>{Math.round(totalMs > 0 ? (displayMs / totalMs) * 100 : 0)}% left</span>
                    {endsAt && <span>ends {fmtTime(endsAt)}</span>}
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "rgba(158,240,210,0.12)" }}>
                <p className="text-[12px] font-mono" style={{ color: LCD_DIM }}>
                  {activeTimer ? (
                    <>
                      Started {fmtTime(activeTimer.startedAt)} · {fmtDate(activeTimer.startedAt)}
                    </>
                  ) : (
                    <>Session starts on press — exact to the second</>
                  )}
                </p>
                {active && pausedSoFar >= 1000 && (
                  <span className="text-[11px] font-mono rounded px-2 py-0.5" style={{ color: LCD_PAUSED, background: "rgba(238,194,122,0.1)" }}>
                    paused {fmtDur(pausedSoFar)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* live status line for screen readers */}
          <p className="sr-only" aria-live="polite">
            {active
              ? `${MODE_LABEL[activeTimer!.mode]} session for ${activeTimer!.category} is ${running ? "running" : "paused"}. Elapsed ${fmtDurLong(elapsed)}.`
              : "No timer running."}
          </p>

          {/* live lap history (only once laps exist for the active session) */}
          {activeTimer && laps.length > 0 && <LapPanel timer={activeTimer} laps={laps} now={now} />}

          {/* controls */}
          <div className="p-4 sm:p-5">
            {!active ? (
              <Btn variant="primary" size="lg" icon="play" className="w-full" onClick={handleStart}>
                {displayIsCountdown ? "Start countdown" : "Start tracking"}
              </Btn>
            ) : running ? (
              <div className="space-y-2.5">
                <Btn variant="primary" size="lg" icon="stop" className="w-full" onClick={() => void app.stopAndSave()}>
                  Stop &amp; save
                </Btn>
                <LapButton onLap={app.recordLap} enabled={true} nextLap={laps.length + 1} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Btn variant="soft" size="lg" icon="pause" onClick={app.pauseTimer}>
                    Pause
                  </Btn>
                  <Btn variant="dangersoft" size="lg" icon="x" onClick={() => setConfirmCancel(true)}>
                    Cancel
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Btn variant="primary" size="lg" icon="play" className="w-full" onClick={app.resumeTimer}>
                  Resume
                </Btn>
                {/* laps pause with the timer — enabled again on Resume */}
                <LapButton onLap={app.recordLap} enabled={false} nextLap={laps.length + 1} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Btn variant="outline" size="lg" icon="stop" onClick={() => void app.stopAndSave()}>
                    Stop &amp; save
                  </Btn>
                  <Btn variant="dangersoft" size="lg" icon="x" onClick={() => setConfirmCancel(true)}>
                    Cancel
                  </Btn>
                </div>
              </div>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-mut text-center">
              <I n="database" className="h-3.5 w-3.5 shrink-0" />
              Anchored to your device clock — stays exact through refreshes, tab switches and sleep.
            </p>
          </div>
        </section>

        {/* ----------------------------- activity form ---------------------------- */}
        <section className="order-2 lg:order-1 card p-4 sm:p-5" aria-label="Activity details">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-[17px] tracking-tight">Activity</h2>
            {active ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-study">
                <I n="timer" className="h-3.5 w-3.5" />
                Locked while tracking
              </span>
            ) : (
              <Btn
                size="sm"
                variant="ghost"
                icon="rotate"
                onClick={() => {
                  setTopic("");
                  setTask("");
                  setCdH("0");
                  setCdM("25");
                  setCdS("0");
                  setCdError("");
                }}
              >
                Clear
              </Btn>
            )}
          </div>

          <fieldset disabled={active} className={active ? "opacity-55 pointer-events-none select-none" : ""}>
            <div className="space-y-4">
              {/* mode */}
              <div>
                <span className="label">Mode</span>
                <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Mode">
                  <button
                    type="button"
                    aria-pressed={mode === "study"}
                    onClick={() => setMode("study")}
                    className={`rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                      mode === "study"
                        ? "border-study/60 bg-study/8 shadow-sm"
                        : "border-line bg-surface hover:border-mut/50"
                    }`}
                  >
                    <span className={`grid place-items-center h-9 w-9 rounded-lg mb-2 ${mode === "study" ? "bg-study/15 text-study" : "bg-raise text-mut"}`}>
                      <I n="book" />
                    </span>
                    <span className="block font-bold text-[15px] leading-none">Study</span>
                    <span className="block text-[11.5px] text-mut mt-1">Physics, Maths, Chem…</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "other"}
                    onClick={() => setMode("other")}
                    className={`rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                      mode === "other"
                        ? "border-other/60 bg-other/8 shadow-sm"
                        : "border-line bg-surface hover:border-mut/50"
                    }`}
                  >
                    <span className={`grid place-items-center h-9 w-9 rounded-lg mb-2 ${mode === "other" ? "bg-other/15 text-other" : "bg-raise text-mut"}`}>
                      <I n="shapes" />
                    </span>
                    <span className="block font-bold text-[15px] leading-none">Other</span>
                    <span className="block text-[11.5px] text-mut mt-1">Coding, reading, gym…</span>
                  </button>
                </div>
              </div>

              <CategoryPicker mode={mode} value={category} onChange={setCategory} />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Topic (optional)" htmlFor="topic-input">
                  <input
                    id="topic-input"
                    className="input"
                    placeholder={mode === "study" ? "e.g. Vectors" : "e.g. Java"}
                    value={topic}
                    maxLength={60}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </Field>
                <Field label="Task (optional)" htmlFor="task-input">
                  <input
                    id="task-input"
                    className="input"
                    placeholder={mode === "study" ? "e.g. Question 19" : "e.g. DSA practice"}
                    value={task}
                    maxLength={60}
                    onChange={(e) => setTask(e.target.value)}
                  />
                </Field>
              </div>

              {/* timer type */}
              <div>
                <span className="label">Timer</span>
                <Segmented
                  ariaLabel="Timer type"
                  value={timerType}
                  onChange={(v) => {
                    setTimerType(v);
                    setCdError("");
                  }}
                  options={[
                    { value: "stopwatch", label: "Stopwatch", icon: "timer" },
                    { value: "countdown", label: "Countdown", icon: "hourglass" },
                  ]}
                />
              </div>

              {timerType === "countdown" && (
                <div className="animate-view rounded-xl border border-line bg-raise/45 p-3.5">
                  <div className="grid grid-cols-3 gap-2.5">
                    <Field label="Hours" htmlFor="cd-h">
                      <input id="cd-h" className="input font-mono font-bold text-center" inputMode="numeric" value={cdH}
                        onChange={(e) => { setCdH(numInput(e.target.value)); setCdError(""); }} onBlur={() => setCdH(String(clampInt(cdH, 0, 99)))} />
                    </Field>
                    <Field label="Minutes" htmlFor="cd-m">
                      <input id="cd-m" className="input font-mono font-bold text-center" inputMode="numeric" value={cdM}
                        onChange={(e) => { setCdM(numInput(e.target.value)); setCdError(""); }} onBlur={() => setCdM(String(clampInt(cdM, 0, 59)))} />
                    </Field>
                    <Field label="Seconds" htmlFor="cd-s">
                      <input id="cd-s" className="input font-mono font-bold text-center" inputMode="numeric" value={cdS}
                        onChange={(e) => { setCdS(numInput(e.target.value)); setCdError(""); }} onBlur={() => setCdS(String(clampInt(cdS, 0, 59)))} />
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-mut mr-1">Quick set</span>
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="chip-off h-8 px-3 text-[12px] font-mono"
                        onClick={() => {
                          setCdH(String(p.h));
                          setCdM(String(p.m));
                          setCdS("0");
                          setCdError("");
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {cdError && (
                    <p role="alert" className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-danger">
                      <I n="alert" className="h-4 w-4 shrink-0" />
                      {cdError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </fieldset>
        </section>
      </div>

      <Confirm
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={app.cancelTimer}
        title="Cancel this session?"
        body={
          <>
            The elapsed time ({activeTimer ? fmtDurLong(getElapsed(activeTimer, Date.now())) : "0 seconds"}) will be{" "}
            <strong className="text-ink">discarded</strong> and nothing will be written to History.
          </>
        }
        confirmLabel="Cancel session"
      />

    </div>
  );
}
