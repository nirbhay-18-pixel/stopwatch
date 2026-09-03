/* ---------------------------------------------------------------------------
   Tempo — core domain: types, exact timestamp math, formatting, backup/CSV.
   All durations are derived from Date.now() timestamps — never from counters.
--------------------------------------------------------------------------- */

export type Mode = "study" | "other";
export type TimerType = "stopwatch" | "countdown";
export type TimerStatus = "running" | "paused";

export interface Session {
  id: string;
  mode: Mode;
  category: string; // subject (study) or category (other)
  topic: string;
  task: string;
  timerType: TimerType;
  startedAt: number; // epoch ms, exact
  endedAt: number; // epoch ms, exact
  duration: number; // active ms (excludes paused time)
  pausedMs: number; // total paused ms within the session
  createdAt: number;
}

export interface Category {
  id: string;
  mode: Mode;
  name: string;
  description?: string;
  isCustom: boolean;
  createdAt: number;
}

export interface ActiveTimer {
  mode: Mode;
  category: string;
  topic: string;
  task: string;
  timerType: TimerType;
  startedAt: number; // first Start press
  resumeAt: number | null; // set while running (last resume)
  accumulatedMs: number; // active time banked before the current run segment
  pausedAt: number | null;
  countdownMs: number; // 0 for stopwatch
  status: TimerStatus;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  defaultTimerType: TimerType;
  defaultMode: Mode;
}

export const SETTINGS_KEY = "tempo.settings.v1";
export const VIEW_KEY = "tempo.view.v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultTimerType: "stopwatch",
  defaultMode: "study",
};

export const MODE_LABEL: Record<Mode, string> = { study: "Study", other: "Other" };

export const DEFAULT_CATEGORIES: Array<Omit<Category, "id" | "createdAt">> = [
  { mode: "study", name: "Physics", isCustom: false },
  { mode: "study", name: "Mathematics", isCustom: false },
  { mode: "study", name: "Chemistry", isCustom: false },
  { mode: "study", name: "Biology", isCustom: false },
  { mode: "study", name: "Computer Science", isCustom: false },
  { mode: "study", name: "English", isCustom: false },
  { mode: "study", name: "Other", isCustom: false },
  { mode: "other", name: "Coding", isCustom: false },
  { mode: "other", name: "Reading", isCustom: false },
  { mode: "other", name: "Exercise", isCustom: false },
  { mode: "other", name: "Project", isCustom: false },
  { mode: "other", name: "Gaming", isCustom: false },
  { mode: "other", name: "Entertainment", isCustom: false },
  { mode: "other", name: "Personal", isCustom: false },
  { mode: "other", name: "Other", isCustom: false },
];

/* ------------------------------- ids ------------------------------------ */
export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------- timestamp math ------------------------------- */
/** Active elapsed ms for a timer at a given wall-clock instant. */
export function getElapsed(t: ActiveTimer, now: number): number {
  const running = t.status === "running" && t.resumeAt != null ? now - t.resumeAt : 0;
  return Math.max(0, t.accumulatedMs + running);
}

export interface HMS {
  h: number;
  m: number;
  s: number;
}
export function msToHMS(ms: number): HMS {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, "0");

/* ----------------------------- formatting -------------------------------- */
/** 00:00:00 style clock. */
export function fmtClock(ms: number): string {
  const { h, m, s } = msToHMS(ms);
  return `${pad2(Math.min(h, 99))}:${pad2(m)}:${pad2(s)}`;
}

/** Compact duration: 3h 42m · 18m 35s · 42s */
export function fmtDur(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const { h, m, s } = msToHMS(ms);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Long duration: 18 minutes 35 seconds */
export function fmtDurLong(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const { h, m, s } = msToHMS(ms);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s > 0 || parts.length === 0) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** 5:34:12 PM — seconds preserved, user's local timezone. */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** 03 Sep 2026 */
export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

/** 03 September 2026 */
export function fmtDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

/** Wed */
export function fmtDayShort(ts: number): string {
  return new Date(ts).toLocaleDateString([], { weekday: "short" });
}

/* --------------------------- date boundaries ------------------------------ */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const weekday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - weekday);
  return d.getTime();
}
export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export const isToday = (ts: number, now: number): boolean => dayKey(ts) === dayKey(now);
export const isYesterday = (ts: number, now: number): boolean =>
  dayKey(ts) === dayKey(now - 86_400_000);

/* ---------------------- datetime-local (with seconds) --------------------- */
export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ------------------------------ validation -------------------------------- */
export function clampInt(v: string | number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
export function cleanText(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

export function sessionMatches(s: Session, q: string): boolean {
  const hay = `${s.category} ${s.topic} ${s.task} ${s.mode} ${s.timerType}`.toLowerCase();
  return hay.includes(q);
}

/* ------------------------------- downloads -------------------------------- */
export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionsToCSV(sessions: Session[]): string {
  const head = [
    "Mode",
    "Subject/Category",
    "Topic",
    "Task",
    "Timer",
    "Started (ISO)",
    "Stopped (ISO)",
    "Started (local)",
    "Stopped (local)",
    "Duration (seconds)",
    "Duration",
    "Paused (seconds)",
    "ID",
  ].join(",");
  const rows = sessions.map((s) =>
    [
      MODE_LABEL[s.mode],
      csvCell(s.category),
      csvCell(s.topic),
      csvCell(s.task),
      s.timerType === "countdown" ? "Countdown" : "Stopwatch",
      new Date(s.startedAt).toISOString(),
      new Date(s.endedAt).toISOString(),
      `${fmtDate(s.startedAt)} ${fmtTime(s.startedAt)}`,
      `${fmtDate(s.endedAt)} ${fmtTime(s.endedAt)}`,
      Math.round(s.duration / 1000),
      fmtDurLong(s.duration),
      Math.round(s.pausedMs / 1000),
      s.id,
    ].join(","),
  );
  return "\uFEFF" + [head, ...rows].join("\r\n");
}

export interface BackupPayload {
  app?: string;
  version?: number;
  exportedAt?: string;
  sessions: Session[];
  categories: Category[];
  settings?: Partial<Settings>;
}

/** Parse + sanitize an imported backup. Throws with a readable message. */
export function parseBackup(text: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const obj = raw as Partial<BackupPayload>;
  if (!obj || !Array.isArray(obj.sessions) || !Array.isArray(obj.categories)) {
    throw new Error("This doesn't look like a Tempo backup file.");
  }
  const now = Date.now();
  const sessions: Session[] = [];
  for (const r of obj.sessions as Array<Partial<Session>>) {
    if (!r || typeof r !== "object") continue;
    const startedAt = Number(r.startedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) continue;
    let duration = Number(r.duration);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    let endedAt = Number(r.endedAt);
    if (!Number.isFinite(endedAt) || endedAt < startedAt) endedAt = startedAt + duration;
    const mode: Mode = r.mode === "other" ? "other" : "study";
    const timerType: TimerType = r.timerType === "countdown" ? "countdown" : "stopwatch";
    const pausedMs = Number.isFinite(Number(r.pausedMs)) && Number(r.pausedMs) > 0 ? Number(r.pausedMs) : 0;
    sessions.push({
      id: typeof r.id === "string" && r.id ? r.id : uid(),
      mode,
      category: cleanText(String(r.category ?? "")) || "Other",
      topic: cleanText(String(r.topic ?? "")),
      task: cleanText(String(r.task ?? "")),
      timerType,
      startedAt,
      endedAt,
      duration,
      pausedMs,
      createdAt: Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : now,
    });
  }
  const categories: Category[] = [];
  const seen = new Set<string>();
  for (const c of obj.categories as Array<Partial<Category>>) {
    if (!c || typeof c !== "object") continue;
    const name = cleanText(String(c.name ?? ""));
    const mode: Mode = c.mode === "other" ? "other" : "study";
    if (!name) continue;
    const k = `${mode}:${name.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    categories.push({
      id: typeof c.id === "string" && c.id ? c.id : uid(),
      mode,
      name,
      description: c.description ? cleanText(String(c.description)) : undefined,
      isCustom: Boolean(c.isCustom),
      createdAt: Number.isFinite(Number(c.createdAt)) ? Number(c.createdAt) : now,
    });
  }
  return { sessions, categories, app: obj.app, version: obj.version, exportedAt: obj.exportedAt };
}

export const sessionFingerprint = (s: Session): string =>
  `${s.startedAt}|${s.endedAt}|${Math.round(s.duration)}|${s.category.toLowerCase()}`;
