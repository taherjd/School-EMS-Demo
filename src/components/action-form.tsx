"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { Alert } from "./ui";

export type ActionState = { error?: string; success?: string };

/**
 * Form wrapper around useActionState. It submits through startTransition instead of the
 * form `action` prop so React does not reset the fields after a validation error –
 * users keep what they typed and only fix the flagged field.
 */
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={`${className} ${pending ? "opacity-70" : ""}`}
      aria-busy={pending}
    >
      {state.error && <div className="mb-3"><Alert tone="error">{state.error}</Alert></div>}
      {state.success && <div className="mb-3"><Alert tone="success">{state.success}</Alert></div>}
      {children}
    </form>
  );
}
