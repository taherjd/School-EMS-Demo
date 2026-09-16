import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { Badge, Input, LinkButton, PageHeader, Select, Table, Td, label, statusTone } from "@/components/ui";
import type { Prisma, StudentStatus } from "@/generated/prisma/client";

const STATUSES: StudentStatus[] = ["APPLICANT", "ENROLLED", "WITHDRAWN", "TRANSFERRED", "GRADUATED"];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; grade?: string; status?: string; flag?: string }> }) {
  const session = await requireRole("ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER");
  const sp = await searchParams;
  const where: Prisma.StudentWhereInput = {};
  if (sp.q) where.OR = [
    { firstName: { contains: sp.q, mode: "insensitive" } },
    { lastName: { contains: sp.q, mode: "insensitive" } },
    { studentNo: { contains: sp.q, mode: "insensitive" } },
    { emiratesId: { contains: sp.q.replace(/[\s-]/g, "") } },
  ];
  if (sp.grade) where.gradeId = sp.grade;
  if (sp.status) where.status = sp.status as StudentStatus;
  else if (!sp.q) where.status = { in: ["APPLICANT", "ENROLLED"] };
  if (sp.flag === "emirati") where.isEmirati = true;
  if (sp.flag === "sod") where.isStudentOfDetermination = true;
  if (sp.flag === "gifted") where.isGifted = true;
  if (sp.flag === "eal") where.isEAL = true;
  if (session.role === "TEACHER") {
    where.section = { OR: [{ homeroomTeacher: { userId: session.userId } }, { assignments: { some: { teacher: { userId: session.userId } } } }] };
  }

  const [students, grades] = await Promise.all([
    prisma.student.findMany({ where, include: { grade: true, section: true }, orderBy: [{ grade: { order: "asc" } }, { lastName: "asc" }], take: 200 }),
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
  ]);
  const canEdit = session.role === "ADMIN" || session.role === "REGISTRAR";

  return (
    <>
      <PageHeader title="Students" subtitle={`${students.length} record(s)`} actions={
        <>
          <LinkButton href="/api/export/students" variant="secondary">Export CSV (KHDA)</LinkButton>
          {canEdit && <LinkButton href="/students/new">New admission</LinkButton>}
        </>
      } />
      <form className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input name="q" placeholder="Search name, ID, Emirates ID" defaultValue={sp.q} />
        <Select name="grade" defaultValue={sp.grade ?? ""}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""}>
          <option value="">Applicants + enrolled</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        <Select name="flag" defaultValue={sp.flag ?? ""}>
          <option value="">All students</option>
          <option value="emirati">Emirati</option>
          <option value="sod">Students of determination</option>
          <option value="gifted">Gifted & talented</option>
          <option value="eal">EAL</option>
        </Select>
        <button className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white">Filter</button>
      </form>
      <Table head={["Student no.", "Name", "Grade / section", "Nationality", "DOB", "KHDA flags", "Status"]}>
        {students.map((s) => (
          <tr key={s.id} className="hover:bg-gray-50">
            <Td><Link href={`/students/${s.id}`} className="font-medium text-brand hover:underline">{s.studentNo}</Link></Td>
            <Td>{s.firstName} {s.lastName}{s.nameAr && <span className="ms-2 text-gray-500">{s.nameAr}</span>}</Td>
            <Td>{s.grade.name}{s.section ? ` – ${s.section.name}` : ""}</Td>
            <Td>{s.nationality}</Td>
            <Td>{fmtDate(s.dateOfBirth)}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {s.isEmirati && <Badge tone="green">Emirati</Badge>}
                {s.isMuslim && <Badge tone="blue">Islamic Ed.</Badge>}
                {s.arabicFirstLanguage ? <Badge tone="blue">Arabic A</Badge> : <Badge>Arabic B</Badge>}
                {s.isStudentOfDetermination && <Badge tone="purple">SoD</Badge>}
                {s.isGifted && <Badge tone="amber">G&T</Badge>}
                {s.isEAL && <Badge>EAL</Badge>}
              </div>
            </Td>
            <Td><Badge tone={statusTone(s.status)}>{label(s.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
