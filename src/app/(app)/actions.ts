"use server";

import { handleActionError } from "@/lib/action-utils";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function toggleLocale() {
  try {
    const store = await cookies();
    const current = store.get(LOCALE_COOKIE)?.value === "ar" ? "ar" : "en";
    store.set(LOCALE_COOKIE, current === "ar" ? "en" : "ar", { path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
  } catch (e) {
    handleActionError(e);
  }
}
