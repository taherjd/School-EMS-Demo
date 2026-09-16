import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader, Table, Td } from "@/components/ui";
import { StaffForm } from "../staff-form";
import { saveStaff } from "../actions";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "REGISTRAR");
  const { id } = await params;
  const staff = await prisma.staff.findUnique({ where: { id }, include: { assignments: { include: { section: { include: { grade: true } }, subject: true } }, homeroomSections: { include: { grade: true } }, user: true } });
  if (!staff) notFound();
  return (
    <>
      <PageHeader title={`${staff.firstName} ${staff.lastName}`} subtitle={`${staff.staffNo} · ${staff.position}${staff.user ? ` · login: ${staff.user.email}` : ""}`} />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Teaching load">
          <Table head={["Section", "Subject", "Periods / week"]} empty="No classes assigned">
            {staff.assignments.map((a) => (
              <tr key={a.id}><Td>{a.section.grade.name} – {a.section.name}</Td><Td>{a.subject.name}</Td><Td>{a.weeklyPeriods}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Homeroom">
          <ul className="text-sm">{staff.homeroomSections.map((s) => <li key={s.id}>{s.grade.name} – {s.name}</li>)}{staff.homeroomSections.length === 0 && <li className="text-gray-500">None</li>}</ul>
        </Card>
      </div>
      <StaffForm action={saveStaff.bind(null, id)} staff={staff} />
    </>
  );
}
