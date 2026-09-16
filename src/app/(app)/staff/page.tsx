import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, daysUntil } from "@/lib/format";
import { Badge, LinkButton, PageHeader, Table, Td, label, statusTone } from "@/components/ui";

export default async function StaffPage() {
  await requireRole("ADMIN", "REGISTRAR");
  const staff = await prisma.staff.findMany({ where: { leaveDate: null }, orderBy: { lastName: "asc" }, include: { _count: { select: { assignments: true, homeroomSections: true } } } });
  const soon = (d: Date | null) => { const n = daysUntil(d); return n !== null && n <= 60; };
  return (
    <>
      <PageHeader title="Staff" subtitle="Teacher approvals, UAE teacher licensing and document expiries" actions={<LinkButton href="/staff/new">Add staff</LinkButton>} />
      <Table head={["Staff no.", "Name", "Position", "Nationality", "KHDA approval", "Teacher licence", "Visa expiry", "Load"]}>
        {staff.map((s) => (
          <tr key={s.id} className="hover:bg-gray-50">
            <Td><Link href={`/staff/${s.id}`} className="font-medium text-brand hover:underline">{s.staffNo}</Link></Td>
            <Td>{s.firstName} {s.lastName}</Td>
            <Td>{s.position}{!s.isTeaching && <span className="text-gray-500"> (non-teaching)</span>}</Td>
            <Td>{s.nationality}</Td>
            <Td>{s.khdaApprovalRef ?? <Badge tone="amber">missing</Badge>}</Td>
            <Td>
              <Badge tone={statusTone(s.licenceStatus)}>{label(s.licenceStatus)}</Badge>
              {s.licenceExpiry && <div className={`text-xs ${soon(s.licenceExpiry) ? "text-red-600" : "text-gray-500"}`}>exp. {fmtDate(s.licenceExpiry)}</div>}
            </Td>
            <Td className={soon(s.visaExpiry) ? "text-red-600" : ""}>{fmtDate(s.visaExpiry)}</Td>
            <Td>{s._count.assignments} classes · {s._count.homeroomSections} homeroom</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
