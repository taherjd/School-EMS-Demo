import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtAED, fmtDate, num } from "@/lib/format";
import { Alert, Badge, Card, DL, PageHeader, Table, Td, label, statusTone } from "@/components/ui";

export default async function PortalPage() {
  const session = await requireRole("PARENT", "STUDENT");
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const include = {
    grade: true, section: { include: { homeroomTeacher: true } },
    attendance: { orderBy: { date: "desc" as const }, take: 30 },
    results: { include: { assessment: { include: { subject: true, term: true } } }, orderBy: { assessment: { date: "desc" as const } }, take: 20 },
    invoices: { where: { status: { not: "CANCELLED" as const } }, include: { items: true, payments: true }, orderBy: { issueDate: "desc" as const } },
    contracts: { where: { academicYearId: year?.id } },
  };
  const students = session.role === "PARENT"
    ? await prisma.student.findMany({ where: { guardians: { some: { guardian: { userId: session.userId } } } }, include })
    : await prisma.student.findMany({ where: { userId: session.userId }, include });

  return (
    <>
      <PageHeader title={`Welcome, ${session.name}`} subtitle={session.role === "PARENT" ? "Your children's attendance, results, fees and contracts" : "Your attendance, results and fees"} />
      {students.length === 0 && <Alert tone="info">No students are linked to your account yet. Please contact the school registrar.</Alert>}
      <div className="space-y-8">
        {students.map((s) => {
          const present = s.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
          const contract = s.contracts[0];
          return (
            <section key={s.id}>
              <h2 className="mb-3 text-lg font-semibold">{s.firstName} {s.lastName} <span className="text-sm font-normal text-gray-500">{s.grade.name}{s.section ? ` – ${s.section.name}` : ""} · {s.studentNo}</span></h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Overview">
                  <DL items={[
                    ["Status", label(s.status)],
                    ["Homeroom teacher", s.section?.homeroomTeacher ? `${s.section.homeroomTeacher.firstName} ${s.section.homeroomTeacher.lastName}` : "—"],
                    ["Attendance (last 30 days)", s.attendance.length ? `${Math.round((present / s.attendance.length) * 100)}%` : "—"],
                    ["Parent–School Contract", contract ? <Badge tone={statusTone(contract.status)}>{label(contract.status)}</Badge> : <Badge tone="amber">not issued</Badge>],
                  ]} />
                </Card>
                <Card title="Recent results">
                  <Table head={["Assessment", "Subject", "Marks", "Grade"]} empty="No results yet">
                    {s.results.map((r) => <tr key={r.id}><Td>{r.assessment.name}</Td><Td>{r.assessment.subject.name}</Td><Td>{num(r.marks)} / {r.assessment.maxMarks}</Td><Td>{r.gradeLabel ?? "—"}</Td></tr>)}
                  </Table>
                </Card>
                <Card title="Fees">
                  <Table head={["Invoice", "Due", "Balance", "Status"]} empty="No invoices">
                    {s.invoices.map((inv) => {
                      const total = inv.items.reduce((a, i) => a + num(i.amount), 0), paid = inv.payments.reduce((a, p) => a + num(p.amount), 0);
                      return <tr key={inv.id}><Td>{inv.invoiceNo}</Td><Td>{fmtDate(inv.dueDate)}</Td><Td>{fmtAED(total - paid)}</Td><Td><Badge tone={statusTone(inv.status)}>{label(inv.status)}</Badge></Td></tr>;
                    })}
                  </Table>
                  <p className="mt-2 text-xs text-gray-500">Pay by bank transfer quoting the invoice number, or at the school accounts office.</p>
                </Card>
              </div>
              <Card title="Attendance (last 30 school days)" className="mt-4">
                <div className="flex flex-wrap gap-1">
                  {s.attendance.map((a) => <span key={a.id} title={`${fmtDate(a.date)} – ${label(a.status)}`} className={`h-6 w-6 rounded text-center text-xs leading-6 ${{ PRESENT: "bg-emerald-200", LATE: "bg-amber-200", ABSENT: "bg-red-200", EXCUSED: "bg-sky-200", MEDICAL: "bg-violet-200" }[a.status]}`}>{a.status[0]}</span>)}
                  {s.attendance.length === 0 && <span className="text-sm text-gray-500">No attendance recorded yet</span>}
                </div>
              </Card>
            </section>
          );
        })}
      </div>
    </>
  );
}
