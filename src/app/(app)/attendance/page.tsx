import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, todayDubai, toISODate, daysAgo } from "@/lib/format";
import { attendanceBand, DSIB_RATING_LABEL } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Button, Card, Input, PageHeader, Select, Stat, Table, Td, attendanceTone, label, statusTone } from "@/components/ui";
import { saveRegister } from "./actions";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "MEDICAL"] as const;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ section?: string; date?: string }> }) {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const sp = await searchParams;
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const sections = year
    ? await prisma.section.findMany({
        where: {
          academicYearId: year.id,
          ...(session.role === "TEACHER" ? { OR: [{ homeroomTeacher: { userId: session.userId } }, { assignments: { some: { teacher: { userId: session.userId } } } }] } : {}),
        },
        include: { grade: true },
        orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
      })
    : [];
  const sectionId = sp.section ?? sections[0]?.id;
  const dateStr = sp.date ?? toISODate(todayDubai());
  const day = new Date(`${dateStr}T00:00:00.000Z`);
  const students = sectionId ? await prisma.student.findMany({ where: { sectionId, status: "ENROLLED" }, orderBy: { lastName: "asc" }, include: { attendance: { where: { date: day } } } }) : [];

  // 30-day summary per section: one grouped query instead of one query per section
  const since = daysAgo(30);
  const bySection = await prisma.$queryRaw<{ sectionId: string; status: string; count: bigint }[]>`
    SELECT s."sectionId", a."status", COUNT(*)::bigint AS count
    FROM "Attendance" a JOIN "Student" s ON s."id" = a."studentId"
    WHERE a."date" >= ${since} AND s."sectionId" IS NOT NULL
    GROUP BY s."sectionId", a."status"`;
  const totals = new Map<string, { total: number; present: number }>();
  for (const r of bySection) {
    const t = totals.get(r.sectionId) ?? { total: 0, present: 0 };
    t.total += Number(r.count);
    if (r.status === "PRESENT" || r.status === "LATE") t.present += Number(r.count);
    totals.set(r.sectionId, t);
  }
  const summary = sections.map((s) => {
    const t = totals.get(s.id);
    const pct = t && t.total ? +((t.present / t.total) * 100).toFixed(1) : null;
    return { section: s, pct, total: t?.total ?? 0 };
  });
  const overall = summary.reduce((a, s) => ({ p: a.p + (s.pct ?? 0) * s.total, t: a.t + s.total }), { p: 0, t: 0 });
  const overallPct = overall.t ? +(overall.p / overall.t).toFixed(1) : 0;

  // Persistent absentees (≥ 10% absence in 30 days)
  const absentees = await prisma.attendance.groupBy({ by: ["studentId"], where: { date: { gte: since }, status: { in: ["ABSENT"] } }, _count: { _all: true }, having: { studentId: { _count: { gte: 2 } } } });
  const absenteeStudents = absentees.length ? await prisma.student.findMany({ where: { id: { in: absentees.map((a) => a.studentId) } }, include: { grade: true, section: true } }) : [];

  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily registers · KHDA expects accurate attendance records and follow-up on persistent absence" />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="30-day attendance" value={`${overallPct}%`} hint={`DSIB band: ${DSIB_RATING_LABEL[attendanceBand(overallPct)]}`} tone={attendanceTone(overallPct)} />
        <Stat label="Sections" value={sections.length} />
        <Stat label="Students with 2+ absences (30d)" value={absenteeStudents.length} tone={absenteeStudents.length ? "warn" : "good"} />
        <Stat label="Register date" value={fmtDate(day)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="mb-3 flex flex-wrap items-end gap-2">
            <Select name="section" defaultValue={sectionId ?? ""} className="max-w-xs">{sections.map((s) => <option key={s.id} value={s.id}>{s.grade.name} – {s.name}</option>)}</Select>
            <Input type="date" name="date" defaultValue={dateStr} className="max-w-44" />
            <Button variant="secondary">Load register</Button>
          </form>
          {day.getUTCDay() === 0 || day.getUTCDay() === 6 ? (
            <Alert tone="warn">Selected date is a weekend.</Alert>
          ) : (
            <ActionForm action={saveRegister}>
              <input type="hidden" name="sectionId" value={sectionId ?? ""} />
              <input type="hidden" name="date" value={dateStr} />
              <Table head={["Student", "Status", "Remarks"]} empty="No enrolled students in this section">
                {students.map((s) => {
                  const current = s.attendance[0]?.status ?? "PRESENT";
                  return (
                    <tr key={s.id}>
                      <Td>{s.firstName} {s.lastName}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {STATUSES.map((st) => (
                            <label key={st} className="flex items-center gap-1 text-xs"><input type="radio" name={`status-${s.id}`} value={st} defaultChecked={current === st} /> {label(st)}</label>
                          ))}
                        </div>
                      </Td>
                      <Td><Input name={`remarks-${s.id}`} defaultValue={s.attendance[0]?.remarks ?? ""} placeholder="Optional" /></Td>
                    </tr>
                  );
                })}
              </Table>
              {students.length > 0 && <div className="mt-3"><Button>Save register</Button></div>}
            </ActionForm>
          )}
        </div>
        <div className="space-y-6">
          <Card title="30-day attendance by section">
            <ul className="text-sm">
              {summary.map((s) => (
                <li key={s.section.id} className="flex items-center justify-between border-b border-gray-100 py-1">
                  <span>{s.section.grade.name} – {s.section.name}</span>
                  {s.pct === null ? <span className="text-gray-400">no data</span> : <Badge tone={statusTone(attendanceBand(s.pct))}>{s.pct}%</Badge>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Follow-up: repeated absence">
            <ul className="text-sm">
              {absenteeStudents.map((s) => (
                <li key={s.id} className="border-b border-gray-100 py-1">
                  <a href={`/students/${s.id}`} className="hover:underline">{s.firstName} {s.lastName}</a> <span className="text-gray-500">{s.grade.name}{s.section ? ` – ${s.section.name}` : ""} · {absentees.find((a) => a.studentId === s.id)?._count._all} absences</span>
                </li>
              ))}
              {absenteeStudents.length === 0 && <li className="text-gray-500">None</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
