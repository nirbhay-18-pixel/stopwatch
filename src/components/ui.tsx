/* Shared UI kit: inline SVG icon set + primitives (buttons, modals, toasts). */
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useApp } from "../state/AppContext";

/* --------------------------------- icons --------------------------------- */
export type IconName =
  | "grid" | "timer" | "history" | "chart" | "sliders" | "heatmap"
  | "sun" | "moon" | "monitor"
  | "play" | "pause" | "stop" | "rotate"
  | "plus" | "x" | "check" | "trash" | "pencil" | "search"
  | "download" | "upload" | "book" | "shapes" | "alert"
  | "chevronDown" | "clock" | "hourglass" | "arrowRight" | "database" | "calendar" | "info" | "flag";

const STROKE_ICONS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.5l2.4 2.4M9.5 2.5h5M12 2.5V6" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.3" />
      <path d="M3.5 3.5v4.8h4.8M12 7.5V12l3 3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6.5 20V11M12 20V4.5M17.5 20v-6.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M6 4.5v15M12 4.5v15M18 4.5v15" />
      <circle cx="6" cy="14.5" r="2.1" />
      <circle cx="12" cy="8" r="2.1" />
      <circle cx="18" cy="16.5" r="2.1" />
    </>
  ),
  heatmap: (
    <>
      <rect x="3" y="3" width="4" height="4" rx="0.5" />
      <rect x="10" y="3" width="4" height="4" rx="0.5" />
      <rect x="17" y="3" width="4" height="4" rx="0.5" />
      <rect x="3" y="10" width="4" height="4" rx="0.5" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
      <rect x="17" y="10" width="4" height="4" rx="0.5" />
      <rect x="3" y="17" width="4" height="4" rx="0.5" />
      <rect x="10" y="17" width="4" height="4" rx="0.5" />
      <rect x="17" y="17" width="4" height="4" rx="0.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </>
  ),
  rotate: (
    <>
      <path d="M3.5 4.5v5h5" />
      <path d="M4.2 13.5a8 8 0 1 0 1.5-6.6L3.5 9.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4.5 12.5l5 5L19.5 6.5" />,
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1.2-4.2L16.7 4.3a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20z" />
      <path d="M14.7 6.3l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5L16.2 16.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11.5M7 10.5l5 5 5-5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4M7 8.5l5-5 5 5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19v-14a2.5 2.5 0 0 1 2.5-2.5z" />
    </>
  ),
  shapes: (
    <>
      <circle cx="7" cy="7" r="3.6" />
      <rect x="13.8" y="3.6" width="6.8" height="6.8" rx="1.2" />
      <path d="M7 13.6l4.1 7H2.9z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.6L1.9 20.4h20.2z" />
      <path d="M12 10v4.4M12 17.6h.01" />
    </>
  ),
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 3.2" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3h10v4l-5 5 5 5v4H7v-4l5-5-5-5z" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13.5 6l6 6-6 6" />,
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
      <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21.5v-17" />
      <path d="M5.5 5c4.4-2.4 9.1 2.4 13.5 0v8.6c-4.4 2.4-9.1-2.4-13.5 0" />
    </>
  ),
};

const FILL_ICONS: Record<string, ReactNode> = {
  play: <path d="M8 5.4v13.2a.6.6 0 0 0 .9.5l10.6-6.6a.6.6 0 0 0 0-1L8.9 4.9a.6.6 0 0 0-.9.5z" />,
  pause: (
    <>
      <rect x="6.6" y="5" width="3.6" height="14" rx="1.1" />
      <rect x="13.8" y="5" width="3.6" height="14" rx="1.1" />
    </>
  ),
  stop: <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.6" />,
};

export function I({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  const fill = FILL_ICONS[n];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={fill ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {fill ?? STROKE_ICONS[n]}
    </svg>
  );
}

/* --------------------------------- button --------------------------------- */
type BtnVariant = "primary" | "soft" | "outline" | "ghost" | "danger" | "dangersoft";
type BtnSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASS: Record<BtnVariant, string> = {
  primary: "btn-primary",
  soft: "btn-soft",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
  dangersoft: "btn-dangersoft",
};
const SIZE_CLASS: Record<BtnSize, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg",
  md: "h-11 px-4 text-sm",
  lg: "h-[52px] px-6 text-[15px] rounded-xl",
  icon: "h-10 w-10",
};

export function Btn({
  variant = "soft",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
}) {
  return (
    <button type="button" className={`${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`} {...rest}>
      {icon && <I n={icon} className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />}
      {children}
    </button>
  );
}

/* ---------------------------------- modal --------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  /* Latest callback in a ref: parent re-renders (every keystroke of a
     controlled input inside the modal) must NOT re-run the effect below,
     or focus would be yanked back to the panel mid-typing. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /* Focus the panel exactly once, on the closed→open transition only.
       If a field inside already grabbed focus (e.g. autoFocus), leave it. */
    if (!wasOpen.current) {
      wasOpen.current = true;
      requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const ae = document.activeElement;
        if (!ae || !panel.contains(ae)) panel.focus();
      });
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-[#06110c]/55"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card w-full ${wide ? "max-w-lg" : "max-w-md"} animate-pop max-h-[88dvh] flex flex-col outline-none`}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <h2 id={titleId} className="font-display font-bold text-[17px] tracking-tight">
            {title}
          </h2>
          <button type="button" className="icon-btn -mr-1.5" onClick={onClose} aria-label="Close dialog">
            <I n="x" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- confirm --------------------------------- */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Delete",
  tone = "danger",
  requireText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  requireText?: string;
}) {
  const [typed, setTyped] = useSafeState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open, setTyped]);
  const blocked = Boolean(requireText) && typed !== requireText;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Keep it
          </Btn>
          <Btn
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={blocked}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div className="flex gap-3">
        <span className={`shrink-0 h-10 w-10 rounded-lg grid place-items-center ${tone === "danger" ? "bg-danger/12 text-danger" : "bg-pine/12 text-pine"}`}>
          <I n={tone === "danger" ? "alert" : "info"} />
        </span>
        <div className="text-sm text-mut leading-relaxed">{body}</div>
      </div>
      {requireText && (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-typed">
            Type <span className="text-danger normal-case tracking-normal font-mono">{requireText}</span> to confirm
          </label>
          <input
            id="confirm-typed"
            className="input font-mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={requireText}
          />
        </div>
      )}
    </Modal>
  );
}

/* tiny helper: state that resets cleanly */
import { useState } from "react";
function useSafeState(init: string) {
  return useState(init);
}

/* -------------------------------- segmented -------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: Array<{ value: T; label: string; icon?: IconName }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex rounded-lg bg-raise p-1 gap-1 ${size === "sm" ? "h-9" : "h-11"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-bold transition-all duration-150 active:scale-[0.97] ${
              on ? "bg-surface text-ink shadow-sm border border-line" : "text-mut hover:text-ink"
            }`}
          >
            {o.icon && <I n={o.icon} className="h-4 w-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- field ----------------------------------- */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-mut">{hint}</p>}
    </div>
  );
}

/* ------------------------------- empty state -------------------------------- */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-12 px-6 flex flex-col items-center text-center">
      <span className="h-14 w-14 rounded-2xl bg-raise text-mut grid place-items-center mb-4">
        <I n={icon} className="h-6 w-6" />
      </span>
      <h3 className="font-display font-bold text-[16px]">{title}</h3>
      <p className="mt-1.5 text-sm text-mut max-w-[300px] leading-relaxed">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

/* --------------------------------- toasts ----------------------------------- */
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const KIND: Record<string, { bar: string; icon: IconName; text: string }> = {
    success: { bar: "bg-pine", icon: "check", text: "text-pine" },
    error: { bar: "bg-danger", icon: "alert", text: "text-danger" },
    warn: { bar: "bg-study", icon: "alert", text: "text-study" },
    info: { bar: "bg-other", icon: "info", text: "text-other" },
  };
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[70] bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none"
    >
      {toasts.map((t) => {
        const k = KIND[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto animate-toast w-full flex items-center gap-3 bg-surface border border-line rounded-xl shadow-lg pl-3 pr-2 py-2.5 overflow-hidden relative"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${k.bar}`} />
            <span className={`${k.text} shrink-0`}>
              <I n={k.icon} className="h-[18px] w-[18px]" />
            </span>
            <p className="text-[13.5px] font-semibold flex-1 leading-snug">{t.msg}</p>
            <button type="button" className="icon-btn h-8 w-8 shrink-0" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
              <I n="x" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
