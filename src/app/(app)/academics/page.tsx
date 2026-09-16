import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { curriculumCompliance, currentYear } from "@/lib/compliance";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Button, Card, Input, PageHeader, Select, Table, Td, label } from "@/components/ui";
import { createSection, createSubject } from "./actions";

export default async function AcademicsPage() {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const year = await currentYear();
  const [sections, subjects, grades, teachers] = await Promise.all([
    year ? prisma.section.findMany({ where: { academicYearId: year.id }, include: { grade: true, homeroomTeacher: true, _count: { select: { students: { where: { status: "ENROLLED" } }, assignments: true } } }, orderBy: [{ grade: { order: "asc" } }, { name: "asc" }] }) : [],
    prisma.subject.findMany({ orderBy: [{ isKhdaMandatory: "desc" }, { name: "asc" }], include: { requirements: { include: { grade: true }, orderBy: { grade: { order: "asc" } } } } }),
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
    prisma.staff.findMany({ where: { isTeaching: true, leaveDate: null }, orderBy: { lastName: "asc" } }),
  ]);
  const compliance = year ? await curriculumCompliance(year.id) : { issues: [], sections: 0 };
  const canEdit = session.role !== "TEACHER";

  return (
    <>
      <PageHeader title="Academics" subtitle={`Sections, subjects and KHDA curriculum requirements · ${year?.name ?? "no current year"}`} />
      {compliance.issues.length > 0 && (
        <div className="mb-4">
          <Alert tone="warn">
            {compliance.issues.length} KHDA-mandatory subject allocation(s) below the minimum weekly periods:{" "}
            {compliance.issues.map((i) => `${i.section} – ${i.subject} (${i.actual}/${i.required})`).join("; ")}
          </Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Section", "Homeroom teacher", "Students", "Subjects assigned", "KHDA minimums"]}>
            {sections.map((s) => {
              const issues = compliance.issues.filter((i) => i.sectionId === s.id);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td><Link href={`/academics/sections/${s.id}`} className="font-medium text-brand hover:underline">{s.grade.name} – {s.name}</Link></Td>
                  <Td>{s.homeroomTeacher ? `${s.homeroomTeacher.firstName} ${s.homeroomTeacher.lastName}` : "—"}</Td>
                  <Td>{s._count.students} / {s.capacity}</Td>
                  <Td>{s._count.assignments}</Td>
                  <Td>{issues.length ? <Badge tone="red">{issues.length} below minimum</Badge> : <Badge tone="green">OK</Badge>}</Td>
                </tr>
              );
            })}
          </Table>
        </div>
        {canEdit && (
          <Card title="New section">
            <ActionForm action={createSection} className="space-y-2">
              <Select name="gradeId" required defaultValue=""><option value="">Grade…</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
              <Input name="name" placeholder="Section name (A, B…)" required />
              <Input name="capacity" type="number" placeholder="Capacity" defaultValue={25} />
              <Select name="homeroomTeacherId" defaultValue=""><option value="">Homeroom teacher…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</Select>
              <Button>Create</Button>
            </ActionForm>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Code", "Subject", "Applies to", "KHDA mandatory", "Minimum periods / week"]}>
            {subjects.map((s) => (
              <tr key={s.id}>
                <Td>{s.code}</Td>
                <Td>{s.name}{s.nameAr && <span className="ms-2 text-gray-500">{s.nameAr}</span>}</Td>
                <Td>{label(s.applicability)}</Td>
                <Td>{s.isKhdaMandatory ? <Badge tone="blue">mandatory</Badge> : "—"}</Td>
                <Td className="text-xs text-gray-600">{s.requirements.length ? s.requirements.map((r) => `${r.grade.name}: ${r.minWeeklyPeriods}`).join(" · ") : "—"}</Td>
              </tr>
            ))}
          </Table>
        </div>
        {canEdit && (
          <Card title="New subject">
            <ActionForm action={createSubject} className="space-y-2">
              <Input name="code" placeholder="Code (e.g. HIS)" required />
              <Input name="name" placeholder="Name" required />
              <Input name="nameAr" placeholder="Arabic name" dir="rtl" />
              <Select name="applicability">{["ALL", "MUSLIM_ONLY", "ARABIC_NATIVE", "ARABIC_NON_NATIVE"].map((a) => <option key={a} value={a}>{label(a)}</option>)}</Select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isKhdaMandatory" /> KHDA mandatory</label>
              <Button>Create</Button>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
