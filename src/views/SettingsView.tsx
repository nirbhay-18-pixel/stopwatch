import { useRef, useState } from "react";
import { useApp, useExporters } from "../state/AppContext";
import { useAuth } from "../state/AuthContext";
import { Btn, Confirm, I, Modal, Segmented, type IconName } from "../components/ui";
import { fmtDate, parseBackup, type BackupPayload } from "../lib/core";

type Strategy = "merge" | "replace";

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: IconName;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <span className="h-10 w-10 rounded-lg bg-raise text-mut grid place-items-center shrink-0">
        <I n={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] leading-tight">{title}</p>
        <p className="text-[12.5px] text-mut mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const app = useApp();
  const { exportJSON, exportCSV } = useExporters();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; payload: BackupPayload } | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("merge");
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      const payload = parseBackup(text);
      setStrategy("merge");
      setPending({ name: f.name, payload });
    } catch (err) {
      app.toast("error", err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      const res = await app.importData(pending.payload, strategy);
      app.toast(
        "success",
        `Imported ${res.added} session${res.added === 1 ? "" : "s"} · ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"} skipped · ${res.catsAdded} categor${res.catsAdded === 1 ? "y" : "ies"} added.`,
      );
      setPending(null);
    } catch {
      app.toast("error", "Import failed — the file may be corrupted.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <header>
        <h1 className="font-display font-bold text-[22px] tracking-tight leading-none">Settings</h1>
        <p className="text-[13px] text-mut mt-1.5">Preferences, defaults and your data.</p>
      </header>

      {/* appearance */}
      <section className="card p-5" aria-label="Appearance">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-4">Appearance</h2>
        <div className="flex items-center gap-3.5">
          <span className="h-10 w-10 rounded-lg bg-raise text-mut grid place-items-center shrink-0">
            <I n={app.settings.theme === "dark" ? "moon" : app.settings.theme === "light" ? "sun" : "monitor"} className="h-[18px] w-[18px]" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-[14px] leading-tight">Theme</p>
            <p className="text-[12.5px] text-mut mt-0.5">Light, dark, or follow your system.</p>
          </div>
          <div className="w-[240px] max-w-full">
            <Segmented
              size="sm"
              ariaLabel="Theme"
              value={app.settings.theme}
              onChange={(v) => app.updateSettings({ theme: v })}
              options={[
                { value: "light", label: "Light", icon: "sun" },
                { value: "system", label: "Auto", icon: "monitor" },
                { value: "dark", label: "Dark", icon: "moon" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* account & sync */}
      <AccountSection />

      {/* defaults */}
      <section className="card p-5" aria-label="Defaults">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-2">Defaults for new sessions</h2>
        <div className="divide-y divide-line">
          <Row icon="book" title="Default mode" desc="Preselected when you open the timer.">
            <div className="w-[190px]">
              <Segmented
                size="sm"
                ariaLabel="Default mode"
                value={app.settings.defaultMode}
                onChange={(v) => app.updateSettings({ defaultMode: v })}
                options={[
                  { value: "study", label: "Study" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
          </Row>
          <Row icon="timer" title="Default timer" desc="Stopwatch counts up, countdown ends on its own.">
            <div className="w-[230px]">
              <Segmented
                size="sm"
                ariaLabel="Default timer type"
                value={app.settings.defaultTimerType}
                onChange={(v) => app.updateSettings({ defaultTimerType: v })}
                options={[
                  { value: "stopwatch", label: "Stopwatch", icon: "timer" },
                  { value: "countdown", label: "Countdown", icon: "hourglass" },
                ]}
              />
            </div>
          </Row>
        </div>
      </section>

      {/* data */}
      <section className="card p-5" aria-label="Data">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-2">Data</h2>
        <div className="divide-y divide-line">
          <Row icon="download" title="Export backup (JSON)" desc="Everything — sessions, categories, settings — in one portable file.">
            <Btn size="sm" variant="soft" icon="download" onClick={exportJSON}>
              Export
            </Btn>
          </Row>
          <Row icon="chart" title="Export history (CSV)" desc={`${app.sessions.length} session${app.sessions.length === 1 ? "" : "s"} as a spreadsheet-friendly table.`}>
            <Btn size="sm" variant="soft" icon="download" onClick={exportCSV} disabled={app.sessions.length === 0}>
              Export
            </Btn>
          </Row>
          <Row icon="upload" title="Import backup" desc="Restore or merge a previously exported JSON backup.">
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Choose a backup file"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Btn size="sm" variant="soft" icon="upload" onClick={() => fileRef.current?.click()}>
                Import
              </Btn>
            </>
          </Row>
        </div>
        <p className="mt-3 text-[12px] text-mut flex items-start gap-2 leading-relaxed">
          <I n="database" className="h-4 w-4 shrink-0 mt-0.5" />
          All data lives in your browser&rsquo;s IndexedDB on this device. Nothing is uploaded anywhere, and everything survives
          refreshes and restarts.
        </p>
      </section>

      {/* danger */}
      <section className="card p-5 border-danger/35" aria-label="Danger zone">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-2 text-danger">Danger zone</h2>
        <Row icon="trash" title="Clear all data" desc="Deletes every session and custom category. Exports first if you care.">
          <Btn size="sm" variant="dangersoft" icon="trash" onClick={() => setConfirmClear(true)}>
            Clear all
          </Btn>
        </Row>
      </section>

      {/* about */}
      <section className="card p-5" aria-label="About">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-lg bg-pine/12 text-pine grid place-items-center shrink-0">
            <I n="timer" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-[15px] leading-tight">
              Tempo <span className="font-mono text-[11px] text-mut font-semibold ml-1">v1.0 · offline</span>
            </p>
            <p className="text-[12.5px] text-mut mt-0.5 leading-snug">
              Works fully offline — install it to your home screen from the browser menu for an app-like experience.
            </p>
          </div>
        </div>
      </section>

      {/* import modal */}
      <Modal
        open={pending !== null}
        onClose={() => (importing ? null : setPending(null))}
        title="Import backup"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPending(null)} disabled={importing}>
              Cancel
            </Btn>
            <Btn
              variant={strategy === "replace" ? "danger" : "primary"}
              icon="upload"
              disabled={importing}
              onClick={() => void runImport()}
            >
              {strategy === "replace" ? "Replace everything" : `Merge ${pending?.payload.sessions.length ?? 0} sessions`}
            </Btn>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-raise/50 px-4 py-3">
              <p className="font-mono text-[12.5px] font-bold truncate">{pending.name}</p>
              <p className="text-[12.5px] text-mut mt-1">
                Contains <strong className="text-ink">{pending.payload.sessions.length}</strong> session
                {pending.payload.sessions.length === 1 ? "" : "s"} and{" "}
                <strong className="text-ink">{pending.payload.categories.length}</strong> categor
                {pending.payload.categories.length === 1 ? "y" : "ies"}
                {pending.payload.exportedAt && <> · exported {fmtDate(new Date(pending.payload.exportedAt).getTime())}</>}.
              </p>
            </div>
            <fieldset>
              <legend className="label">What should happen?</legend>
              <div className="space-y-2">
                <label
                  className={`flex gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    strategy === "merge" ? "border-pine/50 bg-pine/6" : "border-line hover:border-mut/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    className="mt-1 accent-[rgb(var(--pine))]"
                    checked={strategy === "merge"}
                    onChange={() => setStrategy("merge")}
                  />
                  <span>
                    <span className="block font-semibold text-[13.5px]">Merge — recommended</span>
                    <span className="block text-[12.5px] text-mut mt-0.5 leading-snug">
                      Adds sessions and categories you don&rsquo;t have yet. Duplicates (same start, stop, duration and subject) are
                      skipped. Your current data is untouched.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    strategy === "replace" ? "border-danger/55 bg-danger/6" : "border-line hover:border-mut/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    className="mt-1 accent-[rgb(var(--danger))]"
                    checked={strategy === "replace"}
                    onChange={() => setStrategy("replace")}
                  />
                  <span>
                    <span className="block font-semibold text-[13.5px] text-danger">Replace everything</span>
                    <span className="block text-[12.5px] text-mut mt-0.5 leading-snug">
                      Deletes all current sessions and categories first, then loads the file. This can&rsquo;t be undone.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>
        )}
      </Modal>

      <Confirm
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void app.clearAll()}
        title="Clear all data?"
        requireText="DELETE"
        confirmLabel="Erase everything"
        body={
          <>
            This permanently deletes <strong className="text-ink">{app.sessions.length} session{app.sessions.length === 1 ? "" : "s"}</strong>{" "}
            and all custom categories from this device, and stops any running timer. Consider exporting a JSON backup first — this
            cannot be undone.
          </>
        }
      />
    </div>
  );
}

function AccountSection() {
  const { user, profile, logout, isConfigured } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!isConfigured) {
    return (
      <section className="card p-5 border-study/40" aria-label="Account">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-2 text-study">Cloud Sync</h2>
        <Row icon="database" title="Not configured" desc="Add Supabase credentials to enable cloud sync across devices.">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-study bg-study/10 px-2 py-1 rounded">
            Setup required
          </span>
        </Row>
      </section>
    );
  }

  if (!user) {
    return null; // Auth screen will be shown
  }

  return (
    <>
      <section className="card p-5" aria-label="Account">
        <h2 className="font-display font-bold text-[16px] tracking-tight mb-2">Account</h2>
        <div className="divide-y divide-line">
          <Row icon="database" title="Signed in" desc={user.email || "Unknown email"}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-pine bg-pine/10 px-2 py-1 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-pine" />
              Synced
            </span>
          </Row>
          <Row icon="sliders" title="Sign out" desc="Sign out from this device. Your data remains in the cloud.">
            <Btn size="sm" variant="dangersoft" icon="arrowRight" onClick={() => setConfirmLogout(true)}>
              Sign out
            </Btn>
          </Row>
        </div>
      </section>

      <Confirm
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => void logout()}
        title="Sign out?"
        body={
          <>
            You will be signed out from this device. Your data is safely stored in the cloud and will be available when you sign in again.
          </>
        }
        confirmLabel="Sign out"
      />
    </>
  );
}
