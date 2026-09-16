import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, PageHeader, Select, label, statusTone } from "@/components/ui";
import { generateContract, markContractSigned } from "../../actions";

export default async function ContractPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireRole("ADMIN", "REGISTRAR");
  const { studentId } = await params;
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { grade: true, guardians: { include: { guardian: true } }, contracts: { where: { academicYearId: year?.id }, include: { signedBy: true } } } });
  if (!student) notFound();
  const contract = student.contracts[0];
  return (
    <>
      <PageHeader title="Parent–School Contract" subtitle={`${student.firstName} ${student.lastName} · ${student.grade.name} · ${year?.name ?? ""}`} actions={contract && <Badge tone={statusTone(contract.status)}>{label(contract.status)}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Contract text">
            {contract ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{contract.content}</pre> : <p className="text-sm text-gray-500">No contract generated yet for this academic year.</p>}
            {contract?.signedAt && <p className="mt-4 text-sm text-emerald-700">Signed {fmtDate(contract.signedAt)}{contract.signedBy ? ` by ${contract.signedBy.firstName} ${contract.signedBy.lastName}` : ""}.</p>}
          </Card>
        </div>
        <div className="space-y-6 no-print">
          <Card title="Generate">
            <p className="mb-2 text-xs text-gray-600">Builds the contract from the school profile, the grade’s KHDA-approved fee structure and the term instalment plan. Regenerating resets the signature.</p>
            <ActionForm action={generateContract}><input type="hidden" name="studentId" value={studentId} /><Button>{contract ? "Regenerate" : "Generate"}</Button></ActionForm>
          </Card>
          {contract && contract.status !== "SIGNED" && (
            <Card title="Record signature">
              <ActionForm action={markContractSigned} className="space-y-2">
                <input type="hidden" name="studentId" value={studentId} />
                <Select name="guardianId" defaultValue={student.guardians.find((g) => g.isPrimary)?.guardianId ?? ""}>{student.guardians.map((g) => <option key={g.guardianId} value={g.guardianId}>{g.guardian.firstName} {g.guardian.lastName} ({g.guardian.relationship})</option>)}</Select>
                <Button variant="secondary">Mark signed</Button>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
