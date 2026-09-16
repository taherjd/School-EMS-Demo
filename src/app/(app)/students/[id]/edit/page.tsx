import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ageCutoffDate } from "@/lib/khda";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { StudentForm } from "../../student-form";
import { updateStudent } from "../../actions";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "REGISTRAR");
  const { id } = await params;
  const [student, grades, year, school] = await Promise.all([
    prisma.student.findUnique({ where: { id } }),
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.school.findFirst(),
  ]);
  if (!student) notFound();
  const sections = year ? await prisma.section.findMany({ where: { academicYearId: year.id }, include: { grade: true }, orderBy: [{ grade: { order: "asc" } }, { name: "asc" }] }) : [];
  const cutoff = school && year ? fmtDate(ageCutoffDate(school.academicYearStart, year.startDate)) : "not configured";
  const action = updateStudent.bind(null, id);
  return (
    <>
      <PageHeader title={`Edit ${student.firstName} ${student.lastName}`} subtitle={student.studentNo} />
      <StudentForm action={action} grades={grades} sections={sections} student={student} cutoffLabel={cutoff} />
    </>
  );
}
