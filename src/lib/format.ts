export function fmtDate(d: Date | string | null | undefined, locale = "en") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(date);
}

export function fmtAED(n: number | string | { toString(): string } | null | undefined) {
  if (n === null || n === undefined) return "—";
  const v = typeof n === "number" ? n : Number(n.toString());
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(v);
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayDubai(): Date {
  // Date at midnight UTC for "today" in Dubai (UTC+4), matching the @db.Date attendance column.
  const now = new Date();
  const dubai = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return new Date(Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth(), dubai.getUTCDate()));
}

export function daysUntil(d: Date | null | undefined) {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function num(v: { toString(): string } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}
