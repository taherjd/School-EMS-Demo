import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ageCutoffDate } from "@/lib/khda";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { StudentForm } from "../student-form";
import { createStudent } from "../actions";

export default async function NewStudentPage() {
  await requireRole("ADMIN", "REGISTRAR");
  const [grades, year, school] = await Promise.all([
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.school.findFirst(),
  ]);
  const sections = year ? await prisma.section.findMany({ where: { academicYearId: year.id }, include: { grade: true }, orderBy: [{ grade: { order: "asc" } }, { name: "asc" }] }) : [];
  const cutoff = school && year ? fmtDate(ageCutoffDate(school.academicYearStart, year.startDate)) : "not configured";
  return (
    <>
      <PageHeader title="New admission" subtitle="Creates an applicant record with the KHDA document checklist. Enrol from the student profile once documents are verified." />
      <StudentForm action={createStudent} grades={grades} sections={sections} cutoffLabel={cutoff} />
    </>
  );
}
