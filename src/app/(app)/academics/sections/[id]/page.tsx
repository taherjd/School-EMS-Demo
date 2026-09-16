import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { subjectAppliesToStudent } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { removeAssignment, removeSlot, saveAssignment, saveSlot } from "../../actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const { id } = await params;
  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      grade: { include: { curriculumRequirements: { include: { subject: true } } } },
      homeroomTeacher: true,
      students: { where: { status: "ENROLLED" }, orderBy: { lastName: "asc" } },
      assignments: { include: { subject: true, teacher: true, slots: true }, orderBy: { subject: { name: "asc" } } },
    },
  });
  if (!section) notFound();
  const [subjects, teachers] = await Promise.all([prisma.subject.findMany({ orderBy: { name: "asc" } }), prisma.staff.findMany({ where: { isTeaching: true, leaveDate: null }, orderBy: { lastName: "asc" } })]);
  const canEdit = session.role !== "TEACHER";
  const grid = new Map<string, { subject: string; teacher: string; room: string | null; id: string }>();
  for (const a of section.assignments) for (const s of a.slots) grid.set(`${s.dayOfWeek}-${s.period}`, { subject: a.subject.code, teacher: a.teacher.lastName, room: s.room, id: s.id });

  return (
    <>
      <PageHeader title={`${section.grade.name} – ${section.name}`} subtitle={`${section.students.length} enrolled · capacity ${section.capacity} · homeroom: ${section.homeroomTeacher ? `${section.homeroomTeacher.firstName} ${section.homeroomTeacher.lastName}` : "—"}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Teaching assignments & KHDA minimum periods">
            <Table head={["Subject", "Teacher", "Periods / week", "KHDA minimum", ""]}>
              {section.assignments.map((a) => {
                const req = section.grade.curriculumRequirements.find((r) => r.subjectId === a.subjectId);
                const needed = req && section.students.some((st) => subjectAppliesToStudent(req.subject.applicability, st));
                return (
                  <tr key={a.id}>
                    <Td>{a.subject.name}</Td>
                    <Td>{a.teacher.firstName} {a.teacher.lastName} <Badge tone={a.teacher.licenceStatus === "LICENSED" ? "green" : "amber"}>{a.teacher.licenceStatus.toLowerCase()}</Badge></Td>
                    <Td>{a.weeklyPeriods} <span className="text-xs text-gray-500">({a.slots.length} timetabled)</span></Td>
                    <Td>{req ? (needed ? (a.weeklyPeriods >= req.minWeeklyPeriods ? <Badge tone="green">≥ {req.minWeeklyPeriods}</Badge> : <Badge tone="red">below {req.minWeeklyPeriods}</Badge>) : <span className="text-gray-400">n/a</span>) : "—"}</Td>
                    <Td>{canEdit && <form action={removeAssignment}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="sectionId" value={id} /><button className="text-xs text-red-600 hover:underline">remove</button></form>}</Td>
                  </tr>
                );
              })}
            </Table>
            {section.grade.curriculumRequirements
              .filter((r) => section.students.some((st) => subjectAppliesToStudent(r.subject.applicability, st)) && !section.assignments.some((a) => a.subjectId === r.subjectId))
              .map((r) => <div key={r.id} className="mt-2 text-sm text-red-700">Missing KHDA-mandatory subject: {r.subject.name} (min {r.minWeeklyPeriods} periods/week)</div>)}
            {canEdit && (
              <ActionForm action={saveAssignment} className="mt-4 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="sectionId" value={id} />
                <Select name="subjectId" required defaultValue=""><option value="">Subject…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                <Select name="teacherId" required defaultValue=""><option value="">Teacher…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</Select>
                <Input name="weeklyPeriods" type="number" min={0} placeholder="Periods/week" required />
                <Button variant="secondary">Assign</Button>
              </ActionForm>
            )}
          </Card>

          <Card title="Weekly timetable (Mon–Fri)">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr><th className="p-1 text-start">Period</th>{DAYS.map((d) => <th key={d} className="p-1 text-start">{d}</th>)}</tr></thead>
                <tbody>
                  {PERIODS.map((p) => (
                    <tr key={p} className="border-t border-gray-100">
                      <td className="p-1 font-medium">{p}</td>
                      {DAYS.map((_, di) => {
                        const cell = grid.get(`${di + 1}-${p}`);
                        return (
                          <td key={di} className="p-1">
                            {cell ? (
                              <div className="rounded bg-brand/10 px-2 py-1">
                                <div className="font-medium">{cell.subject}</div>
                                <div className="text-gray-600">{cell.teacher}{cell.room ? ` · ${cell.room}` : ""}</div>
                                {canEdit && <form action={removeSlot}><input type="hidden" name="id" value={cell.id} /><input type="hidden" name="sectionId" value={id} /><button className="text-[10px] text-red-600">×</button></form>}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <ActionForm action={saveSlot} className="mt-4 grid gap-2 md:grid-cols-5">
                <input type="hidden" name="sectionId" value={id} />
                <Select name="assignmentId" required defaultValue=""><option value="">Subject…</option>{section.assignments.map((a) => <option key={a.id} value={a.id}>{a.subject.name}</option>)}</Select>
                <Select name="dayOfWeek">{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select>
                <Select name="period">{PERIODS.map((p) => <option key={p} value={p}>Period {p}</option>)}</Select>
                <Input name="room" placeholder="Room" />
                <Button variant="secondary">Add slot</Button>
              </ActionForm>
            )}
          </Card>
        </div>
        <Card title="Students">
          <ul className="divide-y divide-gray-100 text-sm">
            {section.students.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1">
                <Link href={`/students/${s.id}`} className="hover:underline">{s.firstName} {s.lastName}</Link>
                <span className="flex gap-1">{s.isMuslim && <Badge tone="blue">ISL</Badge>}{s.arabicFirstLanguage ? <Badge tone="blue">AR-A</Badge> : <Badge>AR-B</Badge>}{s.isStudentOfDetermination && <Badge tone="purple">SoD</Badge>}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
