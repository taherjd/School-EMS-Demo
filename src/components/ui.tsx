import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = { default: "text-gray-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-red-700" };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof badgeTones | string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone] ?? badgeTones.gray}`}>{children}</span>;
}

export function statusTone(status: string): string {
  const map: Record<string, string> = {
    ENROLLED: "green", APPLICANT: "blue", WITHDRAWN: "gray", GRADUATED: "purple", TRANSFERRED: "gray",
    PRESENT: "green", ABSENT: "red", LATE: "amber", EXCUSED: "blue", MEDICAL: "purple",
    PAID: "green", PARTIALLY_PAID: "amber", ISSUED: "blue", OVERDUE: "red", CANCELLED: "gray", DRAFT: "gray",
    VERIFIED: "green", RECEIVED: "blue", MISSING: "red", EXPIRED: "red",
    LICENSED: "green", PROVISIONAL: "amber", PENDING: "amber", NOT_REQUIRED: "gray",
    OUTSTANDING: "green", VERY_GOOD: "green", GOOD: "blue", ACCEPTABLE: "amber", WEAK: "red", VERY_WEAK: "red",
    ACTIVE: "green", UNDER_REVIEW: "amber", CLOSED: "gray", SIGNED: "green", SENT: "blue",
    LOW: "gray", MEDIUM: "amber", HIGH: "red", CRITICAL: "red",
  };
  return map[status] ?? "gray";
}

/** Only relative app paths and http(s)/mailto URLs are rendered into href attributes. */
export function safeHref(href: string): string {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const { protocol } = new URL(href);
    return ["http:", "https:", "mailto:"].includes(protocol) ? href : "#";
  } catch {
    return "#";
  }
}

const SEVERITY_TONE: Record<string, string> = { HIGH: "red", MEDIUM: "amber", LOW: "gray" };
export function severityTone(severity: string): string {
  return SEVERITY_TONE[severity] ?? "gray";
}

/** Stat tone for an attendance percentage against the DSIB bands. */
export function attendanceTone(pct: number): "good" | "default" | "warn" {
  if (pct >= 96) return "good";
  if (pct >= 94) return "default";
  return "warn";
}

export function label(v: string) {
  return v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const btn = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({ children, variant = "primary", type = "submit", className = "", ...rest }: { children: ReactNode; variant?: keyof typeof btn; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition ${btn[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: keyof typeof btn }) {
  return (
    <Link href={safeHref(href)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition ${btn[variant]}`}>
      {children}
    </Link>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {hasRows ? children : (
            <tr><td colSpan={head.length} className="px-3 py-6 text-center text-gray-500">{empty ?? "No records"}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${t}`}>{children}</div>;
}

export function DL({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-gray-100 py-1">
          <dt className="text-gray-500">{k}</dt>
          <dd className="text-end font-medium">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
