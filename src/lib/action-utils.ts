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

/** True for the errors Next.js throws on purpose for redirect(), notFound(), forbidden() and unauthorized(). */
export function isNextControlFlowError(e: unknown) {
  if (typeof e !== "object" || e === null || !("digest" in e)) return false;
  const digest = String((e as { digest?: string }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK");
}

export function isRedirectError(e: unknown) {
  return isNextControlFlowError(e) && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

/**
 * Standard catch handler for server actions: lets Next.js control-flow errors propagate,
 * logs anything else server-side and returns a safe message for the form.
 */
export function handleActionError(e: unknown): ActionState {
  if (isNextControlFlowError(e)) throw e;
  console.error("Server action failed", e);
  return { error: "Something went wrong while saving. Please try again or contact the system administrator." };
}
