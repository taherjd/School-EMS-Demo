import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, toISODate } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, Input, PageHeader, Select, Table, Td, label } from "@/components/ui";
import { createAssessment } from "./actions";

export default async function AssessmentsPage() {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { number: "asc" } } } });
  const teacherFilter = session.role === "TEACHER" ? { OR: [{ homeroomTeacher: { userId: session.userId } }, { assignments: { some: { teacher: { userId: session.userId } } } }] } : {};
  const [assessments, sections, subjects] = await Promise.all([
    prisma.assessment.findMany({ where: { term: { academicYearId: year?.id }, section: teacherFilter }, include: { section: { include: { grade: true } }, subject: true, term: true, _count: { select: { results: true } } }, orderBy: { date: "desc" } }),
    year ? prisma.section.findMany({ where: { academicYearId: year.id, ...teacherFilter }, include: { grade: true }, orderBy: [{ grade: { order: "asc" } }, { name: "asc" }] }) : [],
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Assessments" subtitle="Internal assessments and external benchmarks (CAT4, GL, MAP, PISA/TIMSS samples) feed DSIB attainment and progress judgements" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Date", "Assessment", "Section", "Subject", "Term", "Type", "Results"]}>
            {assessments.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td>{fmtDate(a.date)}</Td>
                <Td><Link href={`/assessments/${a.id}`} className="font-medium text-brand hover:underline">{a.name}</Link></Td>
                <Td>{a.section.grade.name} – {a.section.name}</Td>
                <Td>{a.subject.name}</Td>
                <Td>{a.term.name}</Td>
                <Td><Badge tone={a.type === "EXTERNAL_BENCHMARK" ? "purple" : "gray"}>{label(a.type)}</Badge></Td>
                <Td>{a._count.results}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title="New assessment">
          <ActionForm action={createAssessment} className="space-y-2">
            <Input name="name" placeholder="Name" required />
            <Select name="sectionId" required defaultValue=""><option value="">Section…</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.grade.name} – {s.name}</option>)}</Select>
            <Select name="subjectId" required defaultValue=""><option value="">Subject…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <Select name="termId" required defaultValue="">{year?.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            <Select name="type">{["FORMATIVE", "SUMMATIVE", "EXTERNAL_BENCHMARK", "MOCK_EXAM"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
            <Input name="maxMarks" type="number" defaultValue={100} min={1} />
            <Input name="date" type="date" defaultValue={toISODate(new Date())} required />
            <Button>Create</Button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
