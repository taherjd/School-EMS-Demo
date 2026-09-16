"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, logout } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/components/action-form";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), next: z.string().optional() });

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const session = await login(parsed.data.email, parsed.data.password);
  if (!session) return { error: "Invalid email or password." };
  await audit(session.userId, "LOGIN", "User", session.userId);
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : null;
  redirect(next ?? (session.role === "PARENT" || session.role === "STUDENT" ? "/portal" : "/dashboard"));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
