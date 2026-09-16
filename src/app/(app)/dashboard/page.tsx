import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { attendanceSummary, collectFindings, currentYear } from "@/lib/compliance";
import { fmtAED, fmtDate, num } from "@/lib/format";
import { DSIB_RATING_LABEL } from "@/lib/khda";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

export default async function DashboardPage() {
  const session = await requireRole("ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER");
  const year = await currentYear();
  const [school, enrolled, applicants, emirati, sod, staffCount, att, findings, invoices, byGrade] = await Promise.all([
    prisma.school.findFirst(),
    prisma.student.count({ where: { status: "ENROLLED" } }),
    prisma.student.count({ where: { status: "APPLICANT" } }),
    prisma.student.count({ where: { status: "ENROLLED", isEmirati: true } }),
    prisma.student.count({ where: { status: "ENROLLED", isStudentOfDetermination: true } }),
    prisma.staff.count({ where: { leaveDate: null } }),
    attendanceSummary(30),
    collectFindings(),
    prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { items: true, payments: true } }),
    prisma.grade.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { students: { where: { status: "ENROLLED" } } } } } }),
  ]);
  const outstanding = invoices.reduce((sum, inv) => sum + inv.items.reduce((a, i) => a + num(i.amount), 0) - inv.payments.reduce((a, p) => a + num(p.amount), 0), 0);
  const attTone = att.pct >= 96 ? "good" : att.pct >= 94 ? "default" : "warn";

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.name.split(" ")[0]}`}
        subtitle={`${school?.name ?? "School"} · ${school?.curriculum ?? ""} curriculum · Academic year ${year?.name ?? "not set"}${school?.lastDsibRating ? ` · Last DSIB rating: ${DSIB_RATING_LABEL[school.lastDsibRating]}` : ""}`}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Enrolled students" value={enrolled} hint={`${applicants} applicant(s) pending`} />
        <Stat label="Emirati students" value={emirati} hint={enrolled ? `${((emirati / enrolled) * 100).toFixed(0)}% of roll` : undefined} />
        <Stat label="Students of determination" value={sod} hint="Inclusion register" />
        <Stat label="Staff" value={staffCount} />
        <Stat label="Attendance (30d)" value={`${att.pct}%`} hint={`DSIB band: ${DSIB_RATING_LABEL[att.band]}`} tone={attTone} />
        <Stat label="Fees outstanding" value={fmtAED(outstanding)} hint={`${invoices.length} open invoice(s)`} tone={outstanding > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="KHDA compliance findings" className="lg:col-span-2" actions={<Link href="/compliance" className="text-sm text-brand underline">Full report</Link>}>
          {findings.length === 0 ? (
            <p className="text-sm text-emerald-700">No open findings. 🎉</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {findings.slice(0, 8).map((f, i) => (
                <li key={i} className="flex items-start gap-3 py-2 text-sm">
                  <Badge tone={f.severity === "HIGH" ? "red" : f.severity === "MEDIUM" ? "amber" : "gray"}>{f.severity}</Badge>
                  <div>
                    <div className="font-medium">{f.area}</div>
                    <div className="text-gray-600">{f.href ? <Link href={f.href} className="hover:underline">{f.message}</Link> : f.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Enrolment by grade">
          <ul className="space-y-1 text-sm">
            {byGrade.filter((g) => g._count.students > 0).map((g) => (
              <li key={g.id} className="flex items-center justify-between">
                <span>{g.name}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 rounded bg-brand/70" style={{ width: `${Math.min(120, g._count.students * 12)}px` }} />
                  <span className="w-6 text-end font-medium">{g._count.students}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {year && (
        <Card title={`Terms – ${year.name}`} className="mt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {year.terms.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="font-medium">{t.name} <Badge tone={new Date() >= t.startDate && new Date() <= t.endDate ? "green" : "gray"}>{new Date() >= t.startDate && new Date() <= t.endDate ? "current" : "upcoming/past"}</Badge></div>
                <div className="text-gray-600">{fmtDate(t.startDate)} – {fmtDate(t.endDate)}</div>
                <div className="text-gray-500">{t.feeSharePct}% of annual tuition</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
