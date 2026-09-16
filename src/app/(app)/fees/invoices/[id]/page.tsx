import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtAED, fmtDate, num, toISODate } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, DL, Input, PageHeader, Select, Table, Td, label, statusTone } from "@/components/ui";
import { cancelInvoice, recordPayment } from "../../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "ACCOUNTANT");
  const { id } = await params;
  const [inv, school] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { student: { include: { grade: true, guardians: { include: { guardian: true } } } }, term: true, items: true, payments: { orderBy: { paidAt: "desc" } } } }),
    prisma.school.findFirst(),
  ]);
  if (!inv) notFound();
  const total = inv.items.reduce((a, i) => a + num(i.amount), 0), paid = inv.payments.reduce((a, p) => a + num(p.amount), 0);
  const primary = inv.student.guardians.find((g) => g.isPrimary)?.guardian ?? inv.student.guardians[0]?.guardian;
  return (
    <>
      <PageHeader title={`Invoice ${inv.invoiceNo}`} subtitle={`${school?.name ?? ""} · ${inv.term?.name ?? "Ad hoc"}`} actions={<Badge tone={statusTone(inv.status)}>{label(inv.status)}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Bill to">
            <DL items={[
              ["Student", `${inv.student.firstName} ${inv.student.lastName} (${inv.student.studentNo})`],
              ["Grade", inv.student.grade.name],
              ["Guardian", primary ? `${primary.firstName} ${primary.lastName} · ${primary.phone}` : "—"],
              ["Issued", fmtDate(inv.issueDate)],
              ["Due", fmtDate(inv.dueDate)],
            ]} />
          </Card>
          <Card title="Items">
            <Table head={["Type", "Description", "Amount"]}>
              {inv.items.map((i) => <tr key={i.id}><Td>{label(i.type)}</Td><Td>{i.description}</Td><Td className="text-end">{fmtAED(i.amount)}</Td></tr>)}
            </Table>
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div>Total: <strong>{fmtAED(total)}</strong></div>
              <div>Paid: <strong>{fmtAED(paid)}</strong></div>
              <div>Balance: <strong>{fmtAED(total - paid)}</strong></div>
            </div>
          </Card>
          <Card title="Payments">
            <Table head={["Date", "Method", "Reference", "Received by", "Amount"]} empty="No payments yet">
              {inv.payments.map((p) => <tr key={p.id}><Td>{fmtDate(p.paidAt)}</Td><Td>{label(p.method)}</Td><Td>{p.reference ?? "—"}</Td><Td>{p.receivedBy ?? "—"}</Td><Td className="text-end">{fmtAED(p.amount)}</Td></tr>)}
            </Table>
          </Card>
        </div>
        <div className="space-y-6 no-print">
          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
            <Card title="Record payment">
              <ActionForm action={recordPayment} className="space-y-2">
                <input type="hidden" name="invoiceId" value={id} />
                <Input name="amount" type="number" step="0.01" placeholder="Amount (AED)" defaultValue={(total - paid).toFixed(2)} required />
                <Select name="method">{["BANK_TRANSFER", "CARD", "CASH", "CHEQUE", "ONLINE"].map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select>
                <Input name="reference" placeholder="Reference / receipt no." />
                <Input name="paidAt" type="date" defaultValue={toISODate(new Date())} />
                <Button>Record</Button>
              </ActionForm>
            </Card>
          )}
          {inv.status !== "CANCELLED" && paid === 0 && (
            <form action={cancelInvoice}><input type="hidden" name="id" value={id} /><Button variant="danger">Cancel invoice</Button></form>
          )}
        </div>
      </div>
    </>
  );
}
