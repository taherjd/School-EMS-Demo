"use client";

import { useActionState, type ReactNode } from "react";
import { Alert } from "./ui";

export type ActionState = { error?: string; success?: string };

export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={`${className} ${pending ? "opacity-70" : ""}`}>
      {state.error && <div className="mb-3"><Alert tone="error">{state.error}</Alert></div>}
      {state.success && <div className="mb-3"><Alert tone="success">{state.success}</Alert></div>}
      {children}
    </form>
  );
}
