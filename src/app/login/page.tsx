import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input } from "@/components/ui";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (session) redirect("/");
  const { next } = await searchParams;
  const { t } = await getT();
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">DS</div>
          <h1 className="text-xl font-semibold">{t("appName")}</h1>
          <p className="text-sm text-gray-500">KHDA-aligned school management</p>
        </div>
        <ActionForm action={loginAction} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {next && <input type="hidden" name="next" value={next} />}
          <Field label={t("email")}><Input name="email" type="email" autoComplete="username" required /></Field>
          <Field label={t("password")}><Input name="password" type="password" autoComplete="current-password" required /></Field>
          <Button className="w-full justify-center">{t("login")}</Button>
        </ActionForm>
        <p className="mt-4 text-center text-xs text-gray-500">
          Demo: admin@school.test / Password123! (see README for other roles)
        </p>
      </div>
    </main>
  );
}
