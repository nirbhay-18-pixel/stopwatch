import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import type { Mode } from "../lib/core";
import { Btn, Confirm, Field, I, Modal } from "./ui";

/**
 * Subject / category selector with a prominent "+ Other" button that opens a
 * creation form, plus a manager for deleting custom categories (with confirm).
 */
export function CategoryPicker({
  mode,
  value,
  onChange,
}: {
  mode: Mode;
  value: string;
  onChange: (name: string) => void;
}) {
  const { categories, addCategory, deleteCategory } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const list = useMemo(() => categories.filter((c) => c.mode === mode), [categories, mode]);
  const customs = list.filter((c) => c.isCustom);
  const hasValue = list.some((c) => c.name === value);
  const selectId = `category-select-${mode}`;

  return (
    <div>
      <label className="label" htmlFor={selectId}>
        {mode === "study" ? "Subject" : "Category"}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            id={selectId}
            className="input appearance-none pr-9 cursor-pointer font-semibold"
            value={hasValue ? value : value || list[0]?.name || ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {!hasValue && value && <option value={value}>{value}</option>}
            {list.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
                {c.isCustom ? "  ·  custom" : ""}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none">
            <I n="chevronDown" className="h-4 w-4" />
          </span>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => setCreateOpen(true)} aria-label="Create a new category">
          <span className="hidden min-[400px]:inline">Other</span>
        </Btn>
        {customs.length > 0 && (
          <button
            type="button"
            className="icon-btn h-11 w-11 border border-line bg-surface shrink-0"
            onClick={() => setManageOpen(true)}
            aria-label="Manage custom categories"
            title="Manage custom categories"
          >
            <I n="sliders" className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <CreateCategoryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode={mode}
        onCreated={(name) => {
          onChange(name);
          setCreateOpen(false);
        }}
        onSave={addCategory}
      />

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Custom categories">
        {customs.length === 0 ? (
          <p className="text-sm text-mut">No custom categories in this mode yet.</p>
        ) : (
          <ul className="space-y-2">
            {customs.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-line bg-raise/50 px-3.5 py-2.5">
                <span className="h-8 w-8 rounded-md bg-surface border border-line grid place-items-center text-mut shrink-0">
                  <I n={mode === "study" ? "book" : "shapes"} className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  {c.description && <p className="text-xs text-mut truncate">{c.description}</p>}
                </div>
                <button
                  type="button"
                  className="icon-btn text-mut hover:text-danger"
                  onClick={() => setPendingDelete({ id: c.id, name: c.name })}
                  aria-label={`Delete ${c.name}`}
                >
                  <I n="trash" className="h-[18px] w-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-mut leading-relaxed">
          Deleting a category only removes it from the picker — saved sessions keep their label.
        </p>
      </Modal>

      <Confirm
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteCategory(pendingDelete.id);
        }}
        title={`Delete “${pendingDelete?.name ?? ""}”?`}
        body={
          <>
            This removes <strong className="text-ink">{pendingDelete?.name}</strong> from the{" "}
            {mode === "study" ? "Study" : "Other"} picker. Sessions already saved with this label stay in your history.
          </>
        }
        confirmLabel="Delete category"
      />
    </div>
  );
}

function CreateCategoryModal({
  open,
  onClose,
  mode,
  onCreated,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onCreated: (name: string) => void;
  onSave: (mode: Mode, name: string, description?: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setDesc("");
    setError("");
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }
    setBusy(true);
    const res = await onSave(mode, name, desc);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save it.");
      return;
    }
    onCreated(name.trim());
    setName("");
    setDesc("");
    setError("");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={mode === "study" ? "New subject" : "New category"}
      footer={
        <>
          <Btn variant="ghost" onClick={close}>
            Cancel
          </Btn>
          <Btn variant="primary" icon="check" onClick={() => void submit()} disabled={busy}>
            Save
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${
            mode === "study" ? "text-study" : "text-other"
          }`}
        >
          <I n={mode === "study" ? "book" : "shapes"} className="h-3.5 w-3.5" />
          {mode === "study" ? "Study mode" : "Other mode"}
        </span>
        <Field label="Name" htmlFor="new-cat-name">
          <input
            id="new-cat-name"
            className="input"
            value={name}
            maxLength={32}
            autoFocus
            placeholder={mode === "study" ? "e.g. Economics" : "e.g. Driving"}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </Field>
        <Field label="Description (optional)" htmlFor="new-cat-desc">
          <input
            id="new-cat-desc"
            className="input"
            value={desc}
            maxLength={80}
            placeholder={mode === "study" ? "e.g. Macro & micro" : "e.g. Driving practice"}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
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
