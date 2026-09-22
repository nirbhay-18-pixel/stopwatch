import { useMemo, useState } from "react";
import { AppProvider, useApp, useNow } from "./state/AppContext";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { NavContext, type View } from "./state/nav";
import { I, Toasts, type IconName } from "./components/ui";
import { AuthScreen } from "./components/AuthScreen";
import { TimerView } from "./views/TimerView";
import { DashboardView } from "./views/DashboardView";
import { HistoryView } from "./views/HistoryView";
import { StatsView } from "./views/StatsView";
import { HeatmapView } from "./views/HeatmapView";
import { SettingsView } from "./views/SettingsView";
import { VIEW_KEY, fmtClock, getElapsed } from "./lib/core";

const NAV: Array<{ v: View; label: string; icon: IconName }> = [
  { v: "timer", label: "Timer", icon: "timer" },
  { v: "dashboard", label: "Dashboard", icon: "grid" },
  { v: "history", label: "History", icon: "history" },
  { v: "stats", label: "Statistics", icon: "chart" },
  { v: "heatmap", label: "Heatmap", icon: "heatmap" },
  { v: "settings", label: "Settings", icon: "sliders" },
];

function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="rgb(var(--pine))" />
      <circle cx="20" cy="22.5" r="9.5" fill="none" stroke="rgb(var(--bg))" strokeWidth="2.5" />
      <path
        d="M20 17.5v5l3.4 3.4"
        stroke="rgb(var(--bg))"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 6h8" stroke="rgb(var(--study))" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M20 8.5v2.5" stroke="rgb(var(--bg))" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle() {
  const { themeDark, updateSettings } = useApp();
  return (
    <button
      type="button"
      className="icon-btn h-10 w-10 border border-line bg-surface"
      onClick={() => updateSettings({ theme: themeDark ? "light" : "dark" })}
      aria-label={themeDark ? "Switch to light mode" : "Switch to dark mode"}
      title={themeDark ? "Light mode" : "Dark mode"}
    >
      <I n={themeDark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}

function LivePill({ onClick }: { onClick?: () => void }) {
  const { activeTimer } = useApp();
  const now = useNow(activeTimer !== null);
  if (!activeTimer) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-pine/45 bg-pine/10 text-pine font-mono text-[12.5px] font-bold tabular transition-transform active:scale-95"
      aria-label={`Timer running for ${activeTimer.category} — open timer`}
    >
      <span className="relative flex h-2 w-2">
        <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-pine" />
      </span>
      {fmtClock(getElapsed(activeTimer, now))}
    </button>
  );
}

function SidebarLiveCard() {
  const { activeTimer } = useApp();
  const now = useNow(activeTimer !== null);
  const go = useGoSafe();
  if (!activeTimer) return null;
  return (
    <button
      type="button"
      onClick={() => go("timer")}
      className="mx-3 mb-3 text-left card p-3.5 border-pine/35 hover:border-pine/60 transition-colors group"
      aria-label="Open the running timer"
    >
      <p className="tick-label text-pine flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-pine" />
        </span>
        {activeTimer.status === "running" ? "Now tracking" : "Paused"}
      </p>
      <p className="mt-1.5 font-mono font-extrabold text-[20px] tabular leading-none">
        {fmtClock(getElapsed(activeTimer, now))}
      </p>
      <p className="mt-1.5 text-[12px] text-mut truncate">
        {activeTimer.category}
        {activeTimer.topic && ` · ${activeTimer.topic}`}
      </p>
    </button>
  );
}

/* tiny accessor so sidebar pieces can navigate without prop drilling */
let goFn: (v: View) => void = () => {};
function useGoSafe() {
  return goFn;
}

function Sidebar({ view, go }: { view: View; go: (v: View) => void }) {
  const { activeTimer } = useApp();
  const hasActiveTimer = activeTimer !== null;

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-[232px] flex-col border-r border-line bg-surface z-40">
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-line shrink-0">
        <Logo />
        <div>
          <p className="font-display font-extrabold text-[17px] leading-none tracking-tight">Tempo</p>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-mut mt-1">Time tracker</p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {NAV.map((n) => {
          const on = view === n.v;
          const isTimer = n.v === "timer";
          return (
            <button
              key={n.v}
              type="button"
              onClick={() => go(n.v)}
              aria-current={on ? "page" : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3.5 h-11 text-[14px] font-semibold transition-all duration-150 relative ${
                on ? "bg-pine/10 text-pine" : "text-mut hover:text-ink hover:bg-raise"
              }`}
            >
              {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-pine" />}
              <I n={n.icon} className="h-[19px] w-[19px]" />
              {n.label}
              {isTimer && hasActiveTimer && (
                <span className="relative flex h-2 w-2 ml-auto">
                  <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pine" />
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <SidebarLiveCard />
      <div className="px-4 py-4 border-t border-line flex items-center justify-between gap-2 shrink-0">
        <ThemeToggle />
        <p className="text-[11px] text-mut font-semibold">
          Offline · <span className="font-mono">v1.0</span>
        </p>
      </div>
    </aside>
  );
}

function MobileNav({ view, go }: { view: View; go: (v: View) => void }) {
  const { activeTimer } = useApp();
  const hasActiveTimer = activeTimer !== null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-6">
        {NAV.map((n) => {
          const on = view === n.v;
          const isTimer = n.v === "timer";
          return (
            <button
              key={n.v}
              type="button"
              onClick={() => go(n.v)}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center gap-[3px] pt-2.5 pb-2 transition-colors ${
                on ? "text-pine" : "text-mut active:text-ink"
              }`}
            >
              {on && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-pine" />}
              <I n={n.icon} className="h-[21px] w-[21px]" />
              <span className="text-[9.5px] font-bold leading-none">{n.label}</span>
              {isTimer && hasActiveTimer && (
                <span className="absolute top-1 right-2 flex h-2 w-2">
                  <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pine" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Splash() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Logo className="h-14 w-14 animate-pulse" />
        <div className="text-center">
          <p className="font-display font-extrabold text-[20px] tracking-tight">Tempo</p>
          <p className="text-[12.5px] text-mut mt-1 flex items-center gap-2 justify-center">
            <I n="timer" className="h-4 w-4 spin-slow" />
            Opening your local data…
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { ready } = useApp();
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v && NAV.some((n) => n.v === v)) return v as View;
    } catch {
      /* fresh browser */
    }
    return "timer";
  });

  const go = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };
  goFn = go;

  const navVal = useMemo(() => ({ view, go }), [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading while checking auth
  if (authLoading) {
    return <Splash />;
  }

  // Show auth screen if not logged in
  if (!user) {
    return <AuthScreen />;
  }

  if (!ready) return <Splash />;

  return (
    <NavContext.Provider value={navVal}>
      <Sidebar view={view} go={go} />

      <header className="md:hidden sticky top-0 z-40 bg-bg/92 backdrop-blur-sm border-b border-line">
        <div className="h-14 px-4 flex items-center justify-between gap-2">
          <button type="button" className="flex items-center gap-2" onClick={() => go("timer")} aria-label="Tempo home">
            <Logo className="h-8 w-8" />
            <span className="font-display font-extrabold text-[16.5px] tracking-tight">Tempo</span>
          </button>
          <div className="flex items-center gap-1.5">
            <LivePill onClick={() => go("timer")} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="md:pl-[232px]">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-14">
          <div key={view} className="animate-view">
            {view === "timer" && <TimerView />}
            {view === "dashboard" && <DashboardView />}
            {view === "history" && <HistoryView />}
            {view === "stats" && <StatsView />}
            {view === "heatmap" && <HeatmapView />}
            {view === "settings" && <SettingsView />}
          </div>
        </div>
      </main>

      <MobileNav view={view} go={go} />
      <Toasts />
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </AuthProvider>
  );
}
