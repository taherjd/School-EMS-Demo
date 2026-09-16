import type { ZodError } from "zod";
import type { ActionState } from "@/components/action-form";

export function zodError(e: ZodError): ActionState {
  return { error: e.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; ") };
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
export function opt(fd: FormData, key: string) {
  const v = str(fd, key);
  return v === "" ? null : v;
}
export function bool(fd: FormData, key: string) {
  return fd.get(key) === "on" || fd.get(key) === "true";
}
export function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}
export function numOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function isRedirectError(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
