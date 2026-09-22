import { useMemo, useState } from "react";
import { useApp, useNow } from "../state/AppContext";
import { useNav } from "../state/nav";
import { Btn, EmptyState, I, Modal } from "../components/ui";
import {
  dayKey,
  fmtDate,
  fmtDateLong,
  fmtDur,
  fmtTime,
  getElapsed,
  isToday,
  lapsOf,
  segmentsOf,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Mode,
  type Session,
} from "../lib/core";

type DrillLevel = "year" | "month" | "day";

interface YearStats {
  totalActive: number;
  totalPaused: number;
  activeDays: number;
  sessionCount: number;
  avgPerActiveDay: number;
  mostActiveMonth: number; // 0-11
  mostActiveDay: number; // epoch ms
  longestSession: Session | null;
  topCategory: string;
  monthlyTotals: number[]; // 12 months
  categoryBreakdown: Map<string, { mode: Mode; ms: number }>;
}

interface MonthStats {
  totalActive: number;
  totalPaused: number;
  activeDays: number;
  sessionCount: number;
  categoryBreakdown: Map<string, { mode: Mode; ms: number }>;
}

interface DayContribution {
  session: Session;
  activeMs: number; // active time in this day
  pausedMs: number; // paused time in this day
}

interface DayData {
  date: number; // epoch ms at start of day
  key: string; // dayKey string
  contributions: DayContribution[];
  totalActive: number; // ms
  totalPaused: number; // ms
  categories: Map<string, { mode: Mode; ms: number }>;
}

/**
 * Split a segment across midnight boundaries.
 * Returns an array of { date, activeMs, pausedMs } for each day the segment touches.
 */
function splitSegmentAcrossDays(segment: { startedAt: number; endedAt: number | null; duration: number; pausedMs: number }): Array<{ date: number; activeMs: number; pausedMs: number }> {
  const result: Array<{ date: number; activeMs: number; pausedMs: number }> = [];
  const start = segment.startedAt;
  const end = segment.endedAt || Date.now();
  
  const totalWallClock = end - start;
  const pauseRatio = totalWallClock > 0 ? segment.pausedMs / totalWallClock : 0;
  
  let current = start;
  while (current < end) {
    const dayStart = startOfDay(current);
    const dayEnd = dayStart + 86_400_000;
    const segmentEnd = Math.min(end, dayEnd);
    
    const dayWallClock = segmentEnd - current;
    const dayPausedMs = Math.round(dayWallClock * pauseRatio);
    const dayActiveMs = dayWallClock - dayPausedMs;
    
    result.push({
      date: dayStart,
      activeMs: dayActiveMs,
      pausedMs: dayPausedMs,
    });
    
    current = dayEnd;
  }
  
  return result;
}

function getIntensityLevel(ms: number): number {
  if (ms === 0) return 0;
  if (ms < 30 * 60 * 1000) return 1; // < 30 min
  if (ms < 2 * 60 * 60 * 1000) return 2; // < 2 hours
  if (ms < 5 * 60 * 60 * 1000) return 3; // < 5 hours
  if (ms < 8 * 60 * 60 * 1000) return 4; // < 8 hours
  return 5; // 8+ hours
}

function getIntensityColor(level: number, themeDark: boolean): string {
  if (level === 0) return themeDark ? "rgb(40 53 46)" : "rgb(231 236 232)";
  if (level === 1) return themeDark ? "rgb(30 80 65 / 0.4)" : "rgb(21 92 74 / 0.25)";
  if (level === 2) return themeDark ? "rgb(30 80 65 / 0.6)" : "rgb(21 92 74 / 0.45)";
  if (level === 3) return themeDark ? "rgb(86 201 167 / 0.5)" : "rgb(21 92 74 / 0.65)";
  if (level === 4) return themeDark ? "rgb(86 201 167 / 0.75)" : "rgb(21 92 74 / 0.8)";
  return themeDark ? "rgb(86 201 167)" : "rgb(21 92 74)";
}

export function HeatmapView() {
  const { sessions, activeTimer, themeDark } = useApp();
  const nav = useNav();
  const now = useNow(activeTimer !== null);
  
  // Navigation state
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("year");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  // Get available years from sessions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const s of sessions) {
      years.add(new Date(s.startedAt).getFullYear());
    }
    // Always include current year
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [sessions]);

  // Build day data map with cross-midnight splitting (cached for all time)
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();
    
    for (const s of sessions) {
      const segments = segmentsOf(s);
      
      for (const segment of segments) {
        const daySplits = splitSegmentAcrossDays(segment);
        
        for (const split of daySplits) {
          const key = dayKey(split.date);
          let day = map.get(key);
          if (!day) {
            day = {
              date: split.date,
              key,
              contributions: [],
              totalActive: 0,
              totalPaused: 0,
              categories: new Map(),
            };
            map.set(key, day);
          }
          
          day.contributions.push({
            session: s,
            activeMs: split.activeMs,
            pausedMs: split.pausedMs,
          });
          
          day.totalActive += split.activeMs;
          day.totalPaused += split.pausedMs;
          
          const cat = day.categories.get(s.category);
          if (cat) {
            cat.ms += split.activeMs;
          } else {
            day.categories.set(s.category, { mode: s.mode, ms: split.activeMs });
          }
        }
      }
    }
    
    return map;
  }, [sessions]);

  // Calculate yearly statistics
  const yearStats = useMemo((): YearStats => {
    const monthlyTotals = Array(12).fill(0);
    const categoryBreakdown = new Map<string, { mode: Mode; ms: number }>();
    let totalActive = 0;
    let totalPaused = 0;
    const activeDaysSet = new Set<string>();
    const sessionIds = new Set<string>();
    let longestSession: Session | null = null;
    let mostActiveDayKey = "";
    let mostActiveDayMs = 0;

    for (const [key, day] of dayMap) {
      const dayDate = new Date(day.date);
      if (dayDate.getFullYear() !== selectedYear) continue;

      totalActive += day.totalActive;
      totalPaused += day.totalPaused;
      activeDaysSet.add(key);
      
      const month = dayDate.getMonth();
      monthlyTotals[month] += day.totalActive;

      if (day.totalActive > mostActiveDayMs) {
        mostActiveDayMs = day.totalActive;
        mostActiveDayKey = key;
      }

      for (const contrib of day.contributions) {
        sessionIds.add(contrib.session.id);
        if (!longestSession || contrib.session.duration > longestSession.duration) {
          longestSession = contrib.session;
        }
        
        const cat = categoryBreakdown.get(contrib.session.category);
        if (cat) {
          cat.ms += contrib.activeMs;
        } else {
          categoryBreakdown.set(contrib.session.category, { 
            mode: contrib.session.mode, 
            ms: contrib.activeMs 
          });
        }
      }
    }

    const mostActiveMonth = monthlyTotals.indexOf(Math.max(...monthlyTotals));
    const avgPerActiveDay = activeDaysSet.size > 0 ? totalActive / activeDaysSet.size : 0;
    const topCategory = Array.from(categoryBreakdown.entries())
      .sort((a, b) => b[1].ms - a[1].ms)[0]?.[0] || "";

    return {
      totalActive,
      totalPaused,
      activeDays: activeDaysSet.size,
      sessionCount: sessionIds.size,
      avgPerActiveDay,
      mostActiveMonth,
      mostActiveDay: mostActiveDayKey ? dayMap.get(mostActiveDayKey)?.date || 0 : 0,
      longestSession,
      topCategory,
      monthlyTotals,
      categoryBreakdown,
    };
  }, [dayMap, selectedYear]);

  // Calculate monthly statistics
  const monthStats = useMemo((): MonthStats => {
    const categoryBreakdown = new Map<string, { mode: Mode; ms: number }>();
    let totalActive = 0;
    let totalPaused = 0;
    const activeDaysSet = new Set<string>();
    const sessionIds = new Set<string>();

    for (const [key, day] of dayMap) {
      const dayDate = new Date(day.date);
      if (dayDate.getFullYear() !== selectedYear || dayDate.getMonth() !== selectedMonth) continue;

      totalActive += day.totalActive;
      totalPaused += day.totalPaused;
      activeDaysSet.add(key);

      for (const contrib of day.contributions) {
        sessionIds.add(contrib.session.id);
        
        const cat = categoryBreakdown.get(contrib.session.category);
        if (cat) {
          cat.ms += contrib.activeMs;
        } else {
          categoryBreakdown.set(contrib.session.category, { 
            mode: contrib.session.mode, 
            ms: contrib.activeMs 
          });
        }
      }
    }

    return {
      totalActive,
      totalPaused,
      activeDays: activeDaysSet.size,
      sessionCount: sessionIds.size,
      categoryBreakdown,
    };
  }, [dayMap, selectedYear, selectedMonth]);

  // Generate date range based on drill level
  const dateRange = useMemo(() => {
    const dates: number[] = [];

    if (drillLevel === "year") {
      // All days in the selected year
      const yearStart = new Date(selectedYear, 0, 1);
      const yearEnd = new Date(selectedYear + 1, 0, 1);
      const daysInYear = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / 86_400_000);
      for (let i = 0; i < daysInYear; i++) {
        dates.push(yearStart.getTime() + i * 86_400_000);
      }
    } else if (drillLevel === "month") {
      // All days in the selected month
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 1);
      const daysInMonth = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
      for (let i = 0; i < daysInMonth; i++) {
        dates.push(monthStart.getTime() + i * 86_400_000);
      }
    } else if (drillLevel === "day") {
      // Just the selected day (if we have one)
      if (selectedDay) {
        dates.push(selectedDay.date);
      }
    }

    return dates;
  }, [drillLevel, selectedYear, selectedMonth, selectedDay]);

  const handleDayClick = (date: number) => {
    const key = dayKey(date);
    const day = dayMap.get(key);
    if (day) {
      if (drillLevel === "year") {
        // Drill down to month view
        setSelectedMonth(new Date(date).getMonth());
        setDrillLevel("month");
      } else if (drillLevel === "month") {
        // Open day detail modal
        setSelectedDay(day);
      }
    }
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setDrillLevel("month");
  };

  const handleBack = () => {
    if (drillLevel === "month") {
      setDrillLevel("year");
    } else if (drillLevel === "day") {
      setDrillLevel("month");
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setDrillLevel("year");
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[22px] tracking-tight leading-none">Activity Heatmap</h1>
          <p className="text-[13px] text-mut mt-1.5">See where your time went, day by day.</p>
        </div>
      </header>

      {/* Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-mut">Year:</label>
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Year selector">
          {availableYears.map((year) => (
            <button
              key={year}
              className={selectedYear === year && drillLevel === "year" ? "chip-on" : "chip-off"}
              aria-pressed={selectedYear === year && drillLevel === "year"}
              onClick={() => handleYearChange(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb navigation */}
      {drillLevel !== "year" && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setDrillLevel("year")}
            className="text-pine hover:text-pinedeep font-semibold"
          >
            {selectedYear}
          </button>
          {drillLevel === "month" && (
            <>
              <I n="arrowRight" className="h-4 w-4 text-mut" />
              <span className="font-semibold">
                {new Date(selectedYear, selectedMonth).toLocaleDateString([], { month: "long" })}
              </span>
            </>
          )}
        </div>
      )}

      {/* Summary cards */}
      {drillLevel === "year" && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="Year summary">
          <div className="card p-4">
            <p className="tick-label">Total active</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{fmtDur(yearStats.totalActive)}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Active days</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{yearStats.activeDays}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Sessions</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{yearStats.sessionCount}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Avg/day</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{fmtDur(yearStats.avgPerActiveDay)}</p>
          </div>
        </section>
      )}

      {drillLevel === "month" && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="Month summary">
          <div className="card p-4">
            <p className="tick-label">Total active</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{fmtDur(monthStats.totalActive)}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Active days</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{monthStats.activeDays}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Sessions</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{monthStats.sessionCount}</p>
          </div>
          <div className="card p-4">
            <p className="tick-label">Categories</p>
            <p className="mt-2 font-mono font-extrabold text-[22px] tabular leading-none">{monthStats.categoryBreakdown.size}</p>
          </div>
        </section>
      )}

      {/* Yearly highlights */}
      {drillLevel === "year" && yearStats.totalActive > 0 && (
        <section className="card p-5" aria-label="Yearly highlights">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">Highlights</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="tick-label">Most active month</p>
              <p className="mt-1 font-semibold">
                {new Date(selectedYear, yearStats.mostActiveMonth).toLocaleDateString([], { month: "long" })}
                <span className="ml-2 text-mut font-normal">{fmtDur(yearStats.monthlyTotals[yearStats.mostActiveMonth])}</span>
              </p>
            </div>
            {yearStats.mostActiveDay > 0 && (
              <div>
                <p className="tick-label">Most active day</p>
                <p className="mt-1 font-semibold">
                  {fmtDate(yearStats.mostActiveDay)}
                  <span className="ml-2 text-mut font-normal">{fmtDur(yearStats.monthlyTotals[new Date(yearStats.mostActiveDay).getMonth()] > 0 ? dayMap.get(dayKey(yearStats.mostActiveDay))?.totalActive || 0 : 0)}</span>
                </p>
              </div>
            )}
            {yearStats.longestSession && (
              <div>
                <p className="tick-label">Longest session</p>
                <p className="mt-1 font-semibold">
                  {fmtDur(yearStats.longestSession.duration)}
                  <span className="ml-2 text-mut font-normal">{yearStats.longestSession.category}</span>
                </p>
              </div>
            )}
            {yearStats.topCategory && (
              <div>
                <p className="tick-label">Top category</p>
                <p className="mt-1 font-semibold">
                  {yearStats.topCategory}
                  <span className="ml-2 text-mut font-normal">
                    {fmtDur(yearStats.categoryBreakdown.get(yearStats.topCategory)?.ms || 0)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Heatmap grid */}
      {sessions.length === 0 ? (
        <section className="card">
          <EmptyState
            icon="heatmap"
            title="No activity yet"
            body="Start tracking sessions to see your activity heatmap here."
          >
            <Btn variant="primary" icon="play" onClick={() => nav.go("timer")}>
              Start tracking
            </Btn>
          </EmptyState>
        </section>
      ) : (
        <section className="card p-5" aria-label="Activity heatmap">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">
            {drillLevel === "year" && `${selectedYear} Activity`}
            {drillLevel === "month" && new Date(selectedYear, selectedMonth).toLocaleDateString([], { month: "long", year: "numeric" })}
          </h2>

          {/* Heatmap grid */}
          <div className="overflow-x-auto">
            {drillLevel === "year" ? (
              <YearHeatmap dates={dateRange} dayMap={dayMap} themeDark={themeDark} onDayClick={handleDayClick} />
            ) : (
              <MonthHeatmap dates={dateRange} dayMap={dayMap} themeDark={themeDark} onDayClick={handleDayClick} />
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-2 text-[11px] text-mut">
            <span>Less</span>
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className="h-3 w-3 rounded-sm"
                style={{ background: getIntensityColor(level, themeDark) }}
                title={`${level === 0 ? "No activity" : level === 1 ? "< 30 min" : level === 2 ? "30 min - 2h" : level === 3 ? "2h - 5h" : level === 4 ? "5h - 8h" : "8h+"}`}
              />
            ))}
            <span>More</span>
          </div>
        </section>
      )}

      {/* Monthly breakdown for year view */}
      {drillLevel === "year" && yearStats.totalActive > 0 && (
        <section className="card p-5" aria-label="Monthly breakdown">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">Monthly Breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {yearStats.monthlyTotals.map((ms, month) => (
              <button
                key={month}
                onClick={() => handleMonthClick(month)}
                className="card p-3 hover:border-pine/50 transition-colors text-left"
              >
                <p className="text-sm font-semibold">
                  {new Date(selectedYear, month).toLocaleDateString([], { month: "short" })}
                </p>
                <p className="mt-1 font-mono text-[15px] font-bold tabular">
                  {ms > 0 ? fmtDur(ms) : "—"}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Category breakdown for month view */}
      {drillLevel === "month" && monthStats.totalActive > 0 && (
        <section className="card p-5" aria-label="Category breakdown">
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">By Category</h2>
          <div className="space-y-2">
            {Array.from(monthStats.categoryBreakdown.entries())
              .sort((a, b) => b[1].ms - a[1].ms)
              .map(([cat, data]) => {
                const pct = monthStats.totalActive > 0 ? (data.ms / monthStats.totalActive) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${data.mode === "study" ? "bg-study" : "bg-other"}`} />
                    <span className="w-[120px] truncate text-[13px] font-semibold">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-raise overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.mode === "study" ? "bg-study" : "bg-other"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-[60px] text-right font-mono text-[12px] font-bold tabular">{fmtDur(data.ms)}</span>
                    <span className="w-[40px] text-right text-[11px] text-mut tabular">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Daily summary modal */}
      {selectedDay && (
        <DailySummaryModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          themeDark={themeDark}
        />
      )}
    </div>
  );
}

function YearHeatmap({
  dates,
  dayMap,
  themeDark,
  onDayClick,
}: {
  dates: number[];
  dayMap: Map<string, DayData>;
  themeDark: boolean;
  onDayClick: (date: number) => void;
}) {
  // Group by weeks (columns)
  const weeks: number[][] = [];
  let currentWeek: number[] = [];

  for (const date of dates) {
    const d = new Date(date);
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0

    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="inline-flex gap-[3px]">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((date) => {
            const key = dayKey(date);
            const day = dayMap.get(key);
            const level = day ? getIntensityLevel(day.totalActive) : 0;
            const isTodayDate = isToday(date, Date.now());

            return (
              <button
                key={date}
                type="button"
                onClick={() => onDayClick(date)}
                className="h-[13px] w-[13px] rounded-sm transition-all hover:scale-110 hover:brightness-110"
                style={{
                  background: getIntensityColor(level, themeDark),
                  border: isTodayDate ? `2px solid rgb(var(--pine))` : "none",
                }}
                title={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
                aria-label={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthHeatmap({
  dates,
  dayMap,
  themeDark,
  onDayClick,
}: {
  dates: number[];
  dayMap: Map<string, DayData>;
  themeDark: boolean;
  onDayClick: (date: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {/* Weekday headers */}
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
        <div key={day} className="text-center text-[10px] font-bold text-mut py-1">
          {day}
        </div>
      ))}
      {/* Days */}
      {dates.map((date) => {
        const key = dayKey(date);
        const day = dayMap.get(key);
        const level = day ? getIntensityLevel(day.totalActive) : 0;
        const isTodayDate = isToday(date, Date.now());
        const dayNum = new Date(date).getDate();

        return (
          <button
            key={date}
            type="button"
            onClick={() => onDayClick(date)}
            className="aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 hover:brightness-110"
            style={{
              background: getIntensityColor(level, themeDark),
              border: isTodayDate ? `2px solid rgb(var(--pine))` : "none",
            }}
            title={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
            aria-label={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
          >
            <span className={`text-[11px] font-bold ${level > 2 ? "text-bg" : "text-ink"}`}>{dayNum}</span>
            {day && <span className={`text-[9px] ${level > 2 ? "text-bg/80" : "text-mut"}`}>{fmtDur(day.totalActive)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function WeekHeatmap({
  dates,
  dayMap,
  themeDark,
  onDayClick,
}: {
  dates: number[];
  dayMap: Map<string, DayData>;
  themeDark: boolean;
  onDayClick: (date: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {dates.map((date) => {
        const key = dayKey(date);
        const day = dayMap.get(key);
        const level = day ? getIntensityLevel(day.totalActive) : 0;
        const isTodayDate = isToday(date, Date.now());
        const dayName = new Date(date).toLocaleDateString([], { weekday: "short" });
        const dayNum = new Date(date).getDate();

        return (
          <button
            key={date}
            type="button"
            onClick={() => onDayClick(date)}
            className="rounded-lg p-3 flex flex-col items-center gap-1 transition-all hover:scale-105 hover:brightness-110"
            style={{
              background: getIntensityColor(level, themeDark),
              border: isTodayDate ? `2px solid rgb(var(--pine))` : "none",
            }}
            title={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
            aria-label={`${fmtDate(date)}: ${day ? fmtDur(day.totalActive) : "No activity"}`}
          >
            <span className={`text-[11px] font-bold ${level > 2 ? "text-bg" : "text-ink"}`}>{dayName}</span>
            <span className={`text-[18px] font-extrabold ${level > 2 ? "text-bg" : "text-ink"}`}>{dayNum}</span>
            {day && <span className={`text-[11px] font-mono ${level > 2 ? "text-bg/80" : "text-mut"}`}>{fmtDur(day.totalActive)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function DayView({
  date,
  dayMap,
  themeDark,
  activeTimer,
  now,
}: {
  date: number;
  dayMap: Map<string, DayData>;
  themeDark: boolean;
  activeTimer: any;
  now: number;
}) {
  const key = dayKey(date);
  const day = dayMap.get(key);
  const isTodayDate = isToday(date, now);

  if (!day && !isTodayDate) {
    return (
      <div className="text-center py-12">
        <p className="text-mut">No activity on this day.</p>
      </div>
    );
  }

  const sortedContributions = day ? [...day.contributions].sort((a, b) => a.session.startedAt - b.session.startedAt) : [];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display font-bold text-[18px]">{fmtDateLong(date)}</p>
        {day && (
          <p className="text-[13px] text-mut mt-1">
            {day.contributions.length} session{day.contributions.length === 1 ? "" : "s"} · {fmtDur(day.totalActive)} active
          </p>
        )}
      </div>

      {/* Timeline */}
      {sortedContributions.length > 0 && (
        <div className="space-y-2">
          {sortedContributions.map((contrib, idx) => (
            <div key={`${contrib.session.id}-${idx}`} className="card p-3 flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <span className={`h-2 w-2 rounded-full ${contrib.session.mode === "study" ? "bg-study" : "bg-other"}`} />
                <span className="w-px flex-1 bg-line my-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {contrib.session.category}
                  {contrib.session.topic && <span className="text-mut font-normal"> · {contrib.session.topic}</span>}
                </p>
                <p className="text-[11px] text-mut mt-0.5">
                  <span className="font-mono font-bold text-ink">{fmtDur(contrib.activeMs)}</span>
                  {contrib.pausedMs > 1000 && <> · paused {fmtDur(contrib.pausedMs)}</>}
                  {contrib.activeMs !== contrib.session.duration && (
                    <span className="text-mut"> · part of {fmtDur(contrib.session.duration)} session</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Currently active */}
      {activeTimer && isTodayDate && (
        <div className="card p-4 border-pine/45 bg-pine/5">
          <p className="tick-label text-pine flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-pine" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pine" />
            </span>
            Currently active
          </p>
          <p className="mt-2 font-mono font-extrabold text-[20px] tabular leading-none">
            {fmtDur(getElapsed(activeTimer, now))}
          </p>
          <p className="mt-1.5 text-[12px] text-mut truncate">
            {activeTimer.category}
            {activeTimer.topic && ` · ${activeTimer.topic}`}
          </p>
        </div>
      )}
    </div>
  );
}

function DailySummaryModal({
  day,
  onClose,
  themeDark,
}: {
  day: DayData;
  onClose: () => void;
  themeDark: boolean;
}) {
  const sortedContributions = [...day.contributions].sort((a, b) => a.session.startedAt - b.session.startedAt);
  const longest = sortedContributions.reduce<{ contrib: DayContribution; activeMs: number } | null>(
    (best, contrib) => (best == null || contrib.activeMs > best.activeMs ? { contrib, activeMs: contrib.activeMs } : best),
    null,
  );
  const first = sortedContributions[0];
  const last = sortedContributions[sortedContributions.length - 1];

  const sortedCategories = [...day.categories.entries()].sort((a, b) => b[1].ms - a[1].ms);
  const maxCat = sortedCategories[0]?.[1].ms ?? 0;

  return (
    <Modal open onClose={onClose} title={fmtDateLong(day.date)} wide>
      <div className="space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-raise/50 p-3">
            <p className="tick-label">Total active</p>
            <p className="mt-1 font-mono font-extrabold text-[18px] tabular">{fmtDur(day.totalActive)}</p>
          </div>
          <div className="rounded-lg bg-raise/50 p-3">
            <p className="tick-label">Total paused</p>
            <p className="mt-1 font-mono font-extrabold text-[18px] tabular">{fmtDur(day.totalPaused)}</p>
          </div>
          <div className="rounded-lg bg-raise/50 p-3">
            <p className="tick-label">Sessions</p>
            <p className="mt-1 font-mono font-extrabold text-[18px] tabular">{day.contributions.length}</p>
          </div>
          <div className="rounded-lg bg-raise/50 p-3">
            <p className="tick-label">Categories</p>
            <p className="mt-1 font-mono font-extrabold text-[18px] tabular">{day.categories.size}</p>
          </div>
        </div>

        {/* Additional stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {longest && (
            <div>
              <p className="tick-label">Longest</p>
              <p className="mt-1 font-mono font-bold text-[14px] tabular">{fmtDur(longest.activeMs)}</p>
            </div>
          )}
          {first && (
            <div>
              <p className="tick-label">First activity</p>
              <p className="mt-1 font-mono font-bold text-[14px] tabular">{fmtTime(first.session.startedAt)}</p>
            </div>
          )}
          {last && (
            <div>
              <p className="tick-label">Last activity</p>
              <p className="mt-1 font-mono font-bold text-[14px] tabular">{fmtTime(last.session.endedAt)}</p>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        {sortedCategories.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-[14px] tracking-tight mb-3">By category</h3>
            <div className="space-y-2">
              {sortedCategories.map(([cat, data]) => {
                const pct = day.totalActive > 0 ? (data.ms / day.totalActive) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${data.mode === "study" ? "bg-study" : "bg-other"}`} />
                    <span className="w-[100px] truncate text-[13px] font-semibold">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-raise overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.mode === "study" ? "bg-study" : "bg-other"}`}
                        style={{ width: `${maxCat > 0 ? (data.ms / maxCat) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-[60px] text-right font-mono text-[12px] font-bold tabular">{fmtDur(data.ms)}</span>
                    <span className="w-[40px] text-right text-[11px] text-mut tabular">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sessions list */}
        {sortedContributions.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-[14px] tracking-tight mb-3">Sessions</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sortedContributions.map((contrib, idx) => (
                <div key={`${contrib.session.id}-${idx}`} className="rounded-lg bg-raise/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">
                        {contrib.session.category}
                        {contrib.session.topic && <span className="text-mut font-normal"> · {contrib.session.topic}</span>}
                        {contrib.session.task && <span className="text-mut font-normal"> · {contrib.session.task}</span>}
                      </p>
                      {contrib.activeMs !== contrib.session.duration && (
                        <p className="text-[10px] text-mut mt-0.5">
                          Part of {fmtDur(contrib.session.duration)} session
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-[13px] font-bold tabular">{fmtDur(contrib.activeMs)}</p>
                      {contrib.pausedMs > 1000 && <p className="text-[10px] text-mut tabular">paused {fmtDur(contrib.pausedMs)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
