"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

const PATHS = {
  home: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  dumbbell: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  chart: "M3 17l6-6 4 4 8-8M15 7h6v6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5L20 7",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  flame: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  play: "M7 4.5v15l13-7.5z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3",
  ruler: "M3 8l5-5 13 13-5 5zM7 7l2 2M10 4l1 1M11 11l2 2M14 8l1 1M15 15l2 2",
  scale: "M4 20h16l-2-14H6zM9 6a3 3 0 0 1 6 0M12 10l2 3",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M5 12h14M13 6l6 6-6 6",
  pin: "M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  edit: "M4 20h4L19 9l-4-4L4 16z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  calendar: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  up: "M12 19V5M5 12l7-7 7 7",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  infinity: "M7 8c-2.2 0-4 1.8-4 4s1.8 4 4 4c3 0 7-8 10-8 2.2 0 4 1.8 4 4s-1.8 4-4 4c-3 0-7-8-10-8z",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  trendDown: "M3 7l6 6 4-4 8 8M15 17h6v-6",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  swap: "M4 8h14l-3-3M20 16H6l3 3",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
  sprout: "M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z",
  crown: "M4 18h16M5 15l-1-9 5 4 3-6 3 6 5-4-1 9z",
  building: "M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 2, className = "" }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  const filled = name === "play";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={name === "dots" ? 3.5 : stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-card ${className}`}>{children}</div>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "plain" | "danger"; size?: "md" | "lg" | "sm" };

export function Button({ variant = "primary", size = "md", className = "", ...props }: BtnProps) {
  const v = {
    primary: "bg-accent text-on-accent font-semibold",
    secondary: "bg-card-2 text-accent-ink font-semibold",
    plain: "text-accent-ink font-medium",
    danger: "bg-card-2 text-bad font-semibold",
  }[variant];
  const s = { sm: "h-9 px-3 text-[15px] rounded-[10px]", md: "h-11 px-4 text-[16px] rounded-xl", lg: "h-[52px] px-5 text-[17px] rounded-[14px]" }[size];
  return (
    <button
      {...props}
      className={`press inline-flex items-center justify-center gap-2 disabled:opacity-40 ${v} ${s} ${className}`}
    />
  );
}

export function LinkButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`press inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-accent px-5 text-[17px] font-semibold text-on-accent ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-label-2">{label}</span>
      <input
        {...props}
        className={`h-12 rounded-xl bg-card px-4 text-[17px] text-label outline-none ring-accent placeholder:text-label-3 focus:ring-2 ${props.className ?? ""}`}
      />
      {hint && <span className="text-[13px] text-label-2">{hint}</span>}
    </label>
  );
}

export function Header({ title, eyebrow, back, right }: { title: string; eyebrow?: string; back?: { href: string; label: string }; right?: ReactNode }) {
  return (
    <header className="safe-top flex items-end justify-between px-5 pb-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        {back && (
          <Link href={back.href} className="press -ml-1 mb-1 flex h-8 items-center gap-0.5 text-[17px] text-accent-ink">
            <Icon name="back" size={22} />
            {back.label}
          </Link>
        )}
        {eyebrow && <span className="text-[13px] font-semibold tracking-wide text-label-2">{eyebrow}</span>}
        <h1 className="truncate font-[family-name:var(--font-display)] text-[34px] font-bold leading-tight tracking-[-0.5px]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-5 pb-2 pt-7">
      <h2 className="text-[22px] font-bold tracking-[-0.3px]">{children}</h2>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="relative grid rounded-[10px] bg-fill p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={sel} onClick={() => onChange(o.value)} className="relative h-8 text-[14px]">
            {sel && <motion.span layoutId="seg" transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)]" />}
            <span className={`relative ${sel ? "font-semibold" : "font-medium text-label-2"}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="safe-bottom relative flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-t-[22px] bg-bg"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-fill" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-[20px] font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Fechar" className="press flex h-9 w-9 items-center justify-center rounded-full bg-fill text-label-2">
                <Icon name="close" size={16} stroke={2.5} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Stat({ label, value, unit, foot, footTone = "muted" }: { label: string; value: string; unit?: string; foot?: string; footTone?: "muted" | "good" | "accent" }) {
  const tone = { muted: "text-label-2", good: "text-good", accent: "text-accent-ink" }[footTone];
  return (
    <Card className="flex flex-col gap-1 px-4 py-3.5">
      <span className="text-[13px] font-semibold text-label-2">{label}</span>
      <span className="tabular text-[26px] font-bold tracking-[-0.4px]">
        {value}
        {unit && <span className="text-[14px] font-medium text-label-2"> {unit}</span>}
      </span>
      {foot && <span className={`text-[13px] font-semibold ${tone}`}>{foot}</span>}
    </Card>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="mx-5 flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
        <Icon name={icon} size={24} />
      </div>
      <span className="text-[17px] font-semibold">{title}</span>
      <span className="text-[15px] leading-snug text-label-2">{text}</span>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}

export function Spinner() {
  return <div className="mx-auto my-10 h-6 w-6 animate-spin rounded-full border-2 border-fill border-t-accent" aria-label="Carregando" />;
}
