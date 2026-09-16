import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, num } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Button, Input, PageHeader, Stat, Table, Td, label } from "@/components/ui";
import { saveResults } from "../actions";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const { id } = await params;
  const a = await prisma.assessment.findUnique({ where: { id }, include: { section: { include: { grade: true, students: { where: { status: "ENROLLED" }, orderBy: { lastName: "asc" } } } }, subject: true, term: true, results: true } });
  if (!a) notFound();
  const marks = a.results.map((r) => num(r.marks));
  const avg = marks.length ? (marks.reduce((x, y) => x + y, 0) / marks.length).toFixed(1) : "—";
  const pctAbove = marks.length ? Math.round((marks.filter((m) => m / a.maxMarks >= 0.6).length / marks.length) * 100) : 0;
  return (
    <>
      <PageHeader title={a.name} subtitle={`${a.section.grade.name} – ${a.section.name} · ${a.subject.name} · ${a.term.name} · ${label(a.type)} · ${fmtDate(a.date)}`} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Results entered" value={`${a.results.length} / ${a.section.students.length}`} />
        <Stat label="Average" value={`${avg} / ${a.maxMarks}`} />
        <Stat label="At or above 60%" value={`${pctAbove}%`} hint="Proxy for 'meeting curriculum expectations'" />
      </div>
      <ActionForm action={saveResults}>
        <input type="hidden" name="assessmentId" value={id} />
        <Table head={["Student", "Marks", "Grade", "Comment"]}>
          {a.section.students.map((s) => {
            const r = a.results.find((x) => x.studentId === s.id);
            return (
              <tr key={s.id}>
                <Td>{s.firstName} {s.lastName}{s.isStudentOfDetermination && <span className="ms-2 text-xs text-violet-700">SoD</span>}</Td>
                <Td><Input name={`marks-${s.id}`} type="number" step="0.5" min={0} max={a.maxMarks} defaultValue={r ? num(r.marks) : ""} className="max-w-28" /></Td>
                <Td>{r?.gradeLabel ?? "—"}</Td>
                <Td><Input name={`comment-${s.id}`} defaultValue={r?.comment ?? ""} /></Td>
              </tr>
            );
          })}
        </Table>
        <div className="mt-3"><Button>Save results</Button></div>
      </ActionForm>
    </>
  );
}
