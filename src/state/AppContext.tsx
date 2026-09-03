/* ---------------------------------------------------------------------------
   Global state + timer engine.
   Elapsed time is ALWAYS derived from wall-clock timestamps (Date.now()),
   so refreshes, tab throttling and sleep can never corrupt the duration.
   The active timer is persisted to IndexedDB on every state transition.
--------------------------------------------------------------------------- */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  cleanText,
  fmtDur,
  getElapsed,
  sessionFingerprint,
  sessionsToCSV,
  uid,
  type ActiveTimer,
  type BackupPayload,
  type Category,
  type Mode,
  type Session,
  type Settings,
  type TimerType,
} from "../lib/core";
import {
  dbAll,
  dbClear,
  dbDelete,
  dbDeleteMeta,
  dbGetMeta,
  dbPut,
  dbPutAll,
  dbSetMeta,
} from "../lib/db";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info" | "warn";
  msg: string;
}

export interface StartForm {
  mode: Mode;
  category: string;
  topic: string;
  task: string;
  timerType: TimerType;
  countdownMs: number;
}

export interface ImportSummary {
  added: number;
  skipped: number;
  catsAdded: number;
}

interface AppCtx {
  ready: boolean;
  sessions: Session[];
  categories: Category[];
  activeTimer: ActiveTimer | null;
  clock: number; // refreshed ~4×/s while a timer is active
  timesUp: Session | null;
  dismissTimesUp: () => void;
  settings: Settings;
  themeDark: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  toasts: Toast[];
  toast: (kind: Toast["kind"], msg: string) => void;
  dismissToast: (id: number) => void;
  startTimer: (form: StartForm) => boolean;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopAndSave: () => Promise<Session | null>;
  cancelTimer: () => void;
  updateSession: (s: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addCategory: (mode: Mode, name: string, description?: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<void>;
  importData: (payload: BackupPayload, strategy: "merge" | "replace") => Promise<ImportSummary>;
  clearAll: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

/** Local re-render clock; only ticks while `enabled` (i.e. a timer is live). */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

function seedCategories(): Category[] {
  const now = Date.now();
  return DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: uid(), createdAt: now + i }));
}

/* guard against double-seeding under React StrictMode in development */
let seedingInFlight = false;

function chime(): void {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [659.25, 830.61, 987.77].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.55);
    });
  } catch {
    /* audio is a nicety — never break on it */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [timesUp, setTimesUp] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [themeDark, setThemeDark] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      /* corrupted prefs → defaults */
    }
    return DEFAULT_SETTINGS;
  });

  const toastId = useRef(1);
  const timerRef = useRef<ActiveTimer | null>(null);
  timerRef.current = activeTimer;

  /* ------------------------------ toasts -------------------------------- */
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: Toast["kind"], msg: string) => {
      const id = toastId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, msg }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  /* ------------------------------ settings ------------------------------ */
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* private mode etc. */
      }
      return next;
    });
  }, []);

  /* -------------------------------- theme -------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      setThemeDark(dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  /* ------------------------------ boot load ------------------------------ */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let cats = await dbAll<Category>("categories");
        if (cats.length === 0 && !seedingInFlight) {
          seedingInFlight = true;
          cats = seedCategories();
          await dbPutAll("categories", cats);
        }
        const sess = await dbAll<Session>("sessions");
        sess.sort((a, b) => b.startedAt - a.startedAt);
        const at = await dbGetMeta<ActiveTimer>("activeTimer");
        if (!alive) return;
        setCategories(cats);
        setSessions(sess);
        if (at && (at.status === "running" || at.status === "paused") && at.startedAt > 0) {
          setActiveTimer(at); // elapsed recomputes from timestamps automatically
        }
      } catch {
        if (alive) toast("error", "Couldn't open the local database — data may not persist.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- timer tick engine ------------------------- */
  const finishCountdownRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!activeTimer) return;
    let lastPersist = Date.now();
    const tick = () => {
      const now = Date.now();
      setClock(now);
      const t = timerRef.current;
      if (!t) return;
      if (t.status === "running") {
        if (now - lastPersist > 15_000) {
          lastPersist = now;
          dbSetMeta("activeTimer", t).catch(() => {});
        }
        if (t.timerType === "countdown" && getElapsed(t, now) >= t.countdownMs) {
          finishCountdownRef.current();
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => tick(); // re-sync instantly when the tab wakes
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [activeTimer]);

  /* ----------------------- timer actions (persisted) ---------------------- */
  const persistTimer = useCallback((t: ActiveTimer | null) => {
    setActiveTimer(t);
    timerRef.current = t;
    if (t) dbSetMeta("activeTimer", t).catch(() => {});
    else dbDeleteMeta("activeTimer").catch(() => {});
  }, []);

  const startTimer = useCallback(
    (form: StartForm): boolean => {
      if (timerRef.current) {
        toast("error", "A timer is already running — finish or cancel it first.");
        return false;
      }
      const category = cleanText(form.category);
      if (!category) {
        toast("error", "Pick a subject or category before starting.");
        return false;
      }
      if (form.timerType === "countdown" && (!Number.isFinite(form.countdownMs) || form.countdownMs <= 0)) {
        toast("error", "Set a countdown longer than zero.");
        return false;
      }
      const now = Date.now();
      const t: ActiveTimer = {
        mode: form.mode,
        category,
        topic: cleanText(form.topic),
        task: cleanText(form.task),
        timerType: form.timerType,
        startedAt: now,
        resumeAt: now,
        accumulatedMs: 0,
        pausedAt: null,
        countdownMs: form.timerType === "countdown" ? Math.round(form.countdownMs) : 0,
        status: "running",
      };
      persistTimer(t);
      setTimesUp(null);
      toast("success", `Tracking started · ${category}`);
      return true;
    },
    [persistTimer, toast],
  );

  const pauseTimer = useCallback(() => {
    const t = timerRef.current;
    if (!t || t.status !== "running" || t.resumeAt == null) return;
    const now = Date.now();
    persistTimer({
      ...t,
      accumulatedMs: getElapsed(t, now),
      resumeAt: null,
      pausedAt: now,
      status: "paused",
    });
    toast("info", "Timer paused — your time is safe.");
  }, [persistTimer, toast]);

  const resumeTimer = useCallback(() => {
    const t = timerRef.current;
    if (!t || t.status !== "paused") return;
    persistTimer({ ...t, resumeAt: Date.now(), pausedAt: null, status: "running" });
    toast("info", "Resumed — keep going.");
  }, [persistTimer, toast]);

  const clearTimer = useCallback(() => {
    persistTimer(null);
  }, [persistTimer]);

  const buildSession = useCallback((t: ActiveTimer, endedAt: number, duration: number): Session => {
    return {
      id: uid(),
      mode: t.mode,
      category: t.category,
      topic: t.topic,
      task: t.task,
      timerType: t.timerType,
      startedAt: t.startedAt,
      endedAt,
      duration,
      pausedMs: Math.max(0, endedAt - t.startedAt - duration),
      createdAt: Date.now(),
    };
  }, []);

  const stopAndSave = useCallback(async (): Promise<Session | null> => {
    const t = timerRef.current;
    if (!t) return null;
    const now = Date.now();
    const duration = Math.round(getElapsed(t, now));
    clearTimer();
    if (duration < 1000) {
      toast("warn", "Session was under a second — nothing was saved.");
      return null;
    }
    const session = buildSession(t, now, duration);
    try {
      await dbPut("sessions", session);
    } catch {
      toast("error", "Saved in memory, but writing to the local database failed.");
    }
    setSessions((prev) => [session, ...prev]);
    toast("success", `Saved · ${t.category} · ${fmtDur(duration)}`);
    return session;
  }, [buildSession, clearTimer, toast]);

  /* Countdown reaching 0 — exact end instant derived from timestamps. */
  finishCountdownRef.current = () => {
    const t = timerRef.current;
    if (!t || t.timerType !== "countdown" || t.status !== "running" || t.resumeAt == null) return;
    const endedAt = t.resumeAt + (t.countdownMs - t.accumulatedMs);
    const session = buildSession(t, endedAt, t.countdownMs);
    clearTimer();
    dbPut("sessions", session).catch(() => {});
    setSessions((prev) => [session, ...prev]);
    setTimesUp(session);
    chime();
    toast("success", "Time's up! Countdown session saved.");
  };

  const cancelTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimer();
    toast("info", "Session cancelled — nothing was saved.");
  }, [clearTimer, toast]);

  /* ------------------------------ session CRUD ---------------------------- */
  const updateSession = useCallback(
    async (s: Session) => {
      await dbPut("sessions", s);
      setSessions((prev) =>
        [s, ...prev.filter((x) => x.id !== s.id)].sort((a, b) => b.startedAt - a.startedAt),
      );
      toast("success", "Session updated.");
    },
    [toast],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await dbDelete("sessions", id);
      setSessions((prev) => prev.filter((x) => x.id !== id));
      toast("info", "Session deleted.");
    },
    [toast],
  );

  /* ------------------------------ categories ------------------------------ */
  const addCategory = useCallback(
    async (mode: Mode, nameRaw: string, description?: string) => {
      const name = cleanText(nameRaw);
      if (!name) return { ok: false, error: "Give it a name." };
      if (name.length > 32) return { ok: false, error: "Keep it under 32 characters." };
      const dup = categories.some((c) => c.mode === mode && c.name.toLowerCase() === name.toLowerCase());
      if (dup) return { ok: false, error: `“${name}” already exists in ${mode === "study" ? "Study" : "Other"}.` };
      const cat: Category = {
        id: uid(),
        mode,
        name,
        description: description ? cleanText(description) : undefined,
        isCustom: true,
        createdAt: Date.now(),
      };
      await dbPut("categories", cat);
      setCategories((prev) => [...prev, cat]);
      toast("success", `“${name}” added.`);
      return { ok: true };
    },
    [categories, toast],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat || !cat.isCustom) {
        toast("error", "Built-in categories can't be deleted.");
        return;
      }
      await dbDelete("categories", id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast("info", `“${cat.name}” deleted. Past sessions keep their label.`);
    },
    [categories, toast],
  );

  /* ------------------------------ data tools ------------------------------ */
  const exportJSON = useCallback(() => {
    const payload: BackupPayload = {
      app: "tempo-tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      categories,
      settings,
    };
    const blobText = JSON.stringify(payload, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([blobText], { type: "application/json" }));
    a.download = "study-tracker-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("success", "Backup exported · study-tracker-backup.json");
  }, [sessions, categories, settings, toast]);

  const exportCSV = useCallback(() => {
    const csv = sessionsToCSV(sessions);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "study-tracker-sessions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("success", "CSV exported · study-tracker-sessions.csv");
  }, [sessions, toast]);

  const importData = useCallback(
    async (payload: BackupPayload, strategy: "merge" | "replace"): Promise<ImportSummary> => {
      let baseSessions = sessions;
      let baseCats = categories;
      if (strategy === "replace") {
        await dbClear("sessions");
        await dbClear("categories");
        baseSessions = [];
        baseCats = [];
      }
      const seenIds = new Set(baseSessions.map((s) => s.id));
      const seenFp = new Set(baseSessions.map(sessionFingerprint));
      const newSessions = payload.sessions.filter((s) => {
        if (seenIds.has(s.id) || seenFp.has(sessionFingerprint(s))) return false;
        return true;
      });
      if (newSessions.length > 0) await dbPutAll("sessions", newSessions);

      const catKey = new Set(baseCats.map((c) => `${c.mode}:${c.name.toLowerCase()}`));
      const newCats = payload.categories.filter((c) => !catKey.has(`${c.mode}:${c.name.toLowerCase()}`));
      let seeded: Category[] = [];
      if (strategy === "replace" && newCats.length === 0) seeded = seedCategories();
      const allNewCats = [...newCats, ...seeded];
      if (allNewCats.length > 0) await dbPutAll("categories", allNewCats);

      setSessions((prev) => [...newSessions, ...prev].sort((a, b) => b.startedAt - a.startedAt));
      setCategories((prev) => [...prev, ...allNewCats]);
      return {
        added: newSessions.length,
        skipped: payload.sessions.length - newSessions.length,
        catsAdded: allNewCats.length,
      };
    },
    [sessions, categories],
  );

  const clearAll = useCallback(async () => {
    await dbClear("sessions");
    await dbClear("categories");
    await dbDeleteMeta("activeTimer");
    const seeded = seedCategories();
    await dbPutAll("categories", seeded);
    setSessions([]);
    setCategories(seeded);
    setActiveTimer(null);
    timerRef.current = null;
    setTimesUp(null);
    toast("success", "All data cleared. Fresh start.");
  }, [toast]);

  /* -------------------- warn before closing with a live timer -------------- */
  useEffect(() => {
    if (!activeTimer) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [activeTimer]);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      sessions,
      categories,
      activeTimer,
      clock,
      timesUp,
      dismissTimesUp: () => setTimesUp(null),
      settings,
      themeDark,
      updateSettings,
      toasts,
      toast,
      dismissToast,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopAndSave,
      cancelTimer,
      updateSession,
      deleteSession,
      addCategory,
      deleteCategory,
      importData,
      clearAll,
    }),
    [
      ready, sessions, categories, activeTimer, clock, timesUp, settings, themeDark,
      updateSettings, toasts, toast, dismissToast, startTimer, pauseTimer, resumeTimer,
      stopAndSave, cancelTimer, updateSession, deleteSession, addCategory, deleteCategory,
      importData, clearAll,
    ],
  );

  /* export helpers ride along on the context object for views */
  const full = useMemo(() => ({ ...value, exportJSON, exportCSV }), [value, exportJSON, exportCSV]);
  return <Ctx.Provider value={full as AppCtx & { exportJSON: () => void; exportCSV: () => void }}>{children}</Ctx.Provider>;
}

export function useExporters(): { exportJSON: () => void; exportCSV: () => void } {
  const v = useContext(Ctx) as unknown as { exportJSON: () => void; exportCSV: () => void } | null;
  if (!v) throw new Error("useExporters must be used inside <AppProvider>");
  return { exportJSON: v.exportJSON, exportCSV: v.exportCSV };
}
