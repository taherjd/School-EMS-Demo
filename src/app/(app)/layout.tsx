import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { SideNav, type NavItem } from "@/components/nav";
import { logoutAction } from "@/app/login/actions";
import { toggleLocale } from "./actions";
import type { Role } from "@/generated/prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { t } = await getT();

  const all: (NavItem & { roles: Role[] })[] = [
    { href: "/dashboard", label: t("dashboard"), icon: "▦", roles: ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER"] },
    { href: "/students", label: t("students"), icon: "👤", roles: ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER"] },
    { href: "/staff", label: t("staff"), icon: "🧑‍🏫", roles: ["ADMIN", "REGISTRAR"] },
    { href: "/academics", label: t("academics"), icon: "📚", roles: ["ADMIN", "REGISTRAR", "TEACHER"] },
    { href: "/attendance", label: t("attendance"), icon: "🗓", roles: ["ADMIN", "REGISTRAR", "TEACHER"] },
    { href: "/assessments", label: t("assessments"), icon: "📝", roles: ["ADMIN", "REGISTRAR", "TEACHER"] },
    { href: "/fees", label: t("fees"), icon: "💳", roles: ["ADMIN", "ACCOUNTANT"] },
    { href: "/compliance", label: t("compliance"), icon: "✅", roles: ["ADMIN", "REGISTRAR", "ACCOUNTANT"] },
    { href: "/portal", label: t("portal"), icon: "🏠", roles: ["PARENT", "STUDENT"] },
    { href: "/settings", label: t("settings"), icon: "⚙", roles: ["ADMIN"] },
  ];
  const items = all.filter((i) => i.roles.includes(session.role)).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-brand-dark text-white md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-bold">DS</div>
          <div className="text-sm font-semibold leading-tight">{t("appName")}</div>
        </div>
        <SideNav items={items} />
        <div className="mt-auto p-4 text-xs text-white/60">KHDA-aligned · v0.1</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{session.name}</span> · {session.role.toLowerCase()}
          </div>
          <div className="flex items-center gap-2">
            <form action={toggleLocale}><button className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">{t("language")}</button></form>
            <form action={logoutAction}><button className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">{t("logout")}</button></form>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1 md:hidden">
          {items.map((i) => (
            <a key={i.href} href={i.href} className="whitespace-nowrap rounded px-2 py-1 text-xs text-gray-700">{i.label}</a>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
