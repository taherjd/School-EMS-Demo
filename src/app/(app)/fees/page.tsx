import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtAED, fmtDate, num, isoDaysFromNow } from "@/lib/format";
import { FEE_INCREASE_MULTIPLIER, MAX_REGISTRATION_DEPOSIT_RATIO, maxFeeIncreasePct, DSIB_RATING_LABEL } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Stat, Table, Td, label, statusTone } from "@/components/ui";
import { generateTermInvoices, saveFeeStructure } from "./actions";
import type { DsibRating } from "@/generated/prisma/client";

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ status?: string; eci?: string }> }) {
  await requireRole("ADMIN", "ACCOUNTANT");
  const sp = await searchParams;
  const [school, year, grades] = await Promise.all([
    prisma.school.findFirst(),
    prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { number: "asc" } }, feeStructures: { include: { grade: true }, orderBy: { grade: { order: "asc" } } } } }),
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
  ]);
  const invoices = await prisma.invoice.findMany({
    where: sp.status ? { status: sp.status as "ISSUED" } : { status: { notIn: ["CANCELLED"] } },
    include: { student: { include: { grade: true } }, items: true, payments: true, term: true },
    orderBy: { issueDate: "desc" },
    take: 200,
  });
  const totals = invoices.reduce((acc, inv) => {
    const t = inv.items.reduce((a, i) => a + num(i.amount), 0), p = inv.payments.reduce((a, x) => a + num(x.amount), 0);
    return { billed: acc.billed + t, collected: acc.collected + p };
  }, { billed: 0, collected: 0 });
  const eci = Number(sp.eci ?? 2.5);

  return (
    <>
      <PageHeader title="Fees" subtitle="KHDA fee framework: approved tuition per grade, deposit cap, term instalments, refunds" actions={<LinkButton href="/fees/refund" variant="secondary">Refund calculator</LinkButton>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Billed (open + paid)" value={fmtAED(totals.billed)} />
        <Stat label="Collected" value={fmtAED(totals.collected)} tone="good" />
        <Stat label="Outstanding" value={fmtAED(totals.billed - totals.collected)} tone={totals.billed - totals.collected > 0 ? "warn" : "good"} />
        <Stat label="Overdue invoices" value={invoices.filter((i) => i.status !== "PAID" && i.dueDate < new Date()).length} tone="bad" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Fee structure ${year?.name ?? ""}`}>
            <Table head={["Grade", "Annual tuition", "Deposit (≤10%)", "Transport", "KHDA approval"]}>
              {(year?.feeStructures ?? []).map((f) => {
                const depositOk = num(f.registrationDeposit) <= num(f.annualTuition) * MAX_REGISTRATION_DEPOSIT_RATIO + 0.005;
                return (
                  <tr key={f.id}>
                    <Td>{f.grade.name}</Td>
                    <Td>{fmtAED(f.annualTuition)}</Td>
                    <Td>{fmtAED(f.registrationDeposit)} {depositOk ? <Badge tone="green">ok</Badge> : <Badge tone="red">exceeds 10%</Badge>}</Td>
                    <Td>{fmtAED(f.transportFee)}</Td>
                    <Td>{f.khdaApprovalRef ?? <Badge tone="amber">missing</Badge>}</Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Set fee for a grade">
            <ActionForm action={saveFeeStructure} className="space-y-2">
              <Select name="gradeId" required defaultValue=""><option value="">Grade…</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
              <Input name="annualTuition" type="number" step="0.01" placeholder="Annual tuition (AED)" required />
              <Input name="registrationDeposit" type="number" step="0.01" placeholder="Registration deposit (≤10%)" required />
              <Input name="khdaApprovalRef" placeholder="KHDA fee approval ref." />
              <div className="grid grid-cols-3 gap-2">
                <Input name="transportFee" type="number" placeholder="Transport" />
                <Input name="booksFee" type="number" placeholder="Books" />
                <Input name="uniformFee" type="number" placeholder="Uniform" />
              </div>
              <Button>Save</Button>
            </ActionForm>
          </Card>
          <Card title="Fee increase ceiling (ECI)">
            <form className="mb-2 flex items-end gap-2">
              <Field label="Educational Cost Index %"><Input name="eci" type="number" step="0.01" defaultValue={eci} /></Field>
              <Button variant="secondary">Calc</Button>
            </form>
            <p className="text-sm">Last DSIB rating: <strong>{school?.lastDsibRating ? DSIB_RATING_LABEL[school.lastDsibRating] : "not set"}</strong> → maximum increase <strong>{maxFeeIncreasePct(school?.lastDsibRating, eci)}%</strong> (subject to KHDA approval).</p>
            <ul className="mt-2 text-xs text-gray-600">
              {(Object.keys(FEE_INCREASE_MULTIPLIER) as DsibRating[]).map((r) => <li key={r}>{DSIB_RATING_LABEL[r]}: {FEE_INCREASE_MULTIPLIER[r]}× ECI = {maxFeeIncreasePct(r, eci)}%</li>)}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Invoices" actions={
            <form className="flex gap-2">
              <Select name="status" defaultValue={sp.status ?? ""}><option value="">All open & paid</option>{["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
              <Button variant="secondary">Filter</Button>
            </form>
          }>
            <Table head={["Invoice", "Student", "Grade", "Term", "Due", "Total", "Balance", "Status"]}>
              {invoices.map((inv) => {
                const total = inv.items.reduce((a, i) => a + num(i.amount), 0), paid = inv.payments.reduce((a, p) => a + num(p.amount), 0);
                const overdue = inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.dueDate < new Date();
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <Td><Link href={`/fees/invoices/${inv.id}`} className="font-medium text-brand hover:underline">{inv.invoiceNo}</Link></Td>
                    <Td>{inv.student.firstName} {inv.student.lastName}</Td>
                    <Td>{inv.student.grade.name}</Td>
                    <Td>{inv.term?.name ?? "—"}</Td>
                    <Td className={overdue ? "text-red-600" : ""}>{fmtDate(inv.dueDate)}</Td>
                    <Td>{fmtAED(total)}</Td>
                    <Td>{fmtAED(total - paid)}</Td>
                    <Td><Badge tone={statusTone(overdue ? "OVERDUE" : inv.status)}>{label(overdue ? "OVERDUE" : inv.status)}</Badge></Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>
        <Card title="Generate term invoices">
          <p className="mb-2 text-xs text-gray-600">Creates one invoice per enrolled student who does not yet have one for the term, using the grade fee structure and the term’s share of annual tuition. Term 1 deducts the registration deposit.</p>
          {year ? (
            <ActionForm action={generateTermInvoices} className="space-y-2">
              <Select name="termId">{year.terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.feeSharePct}%)</option>)}</Select>
              <Input name="dueDate" type="date" defaultValue={isoDaysFromNow(14)} required />
              <Button>Generate</Button>
            </ActionForm>
          ) : <Alert tone="warn">No current academic year.</Alert>}
        </Card>
      </div>
    </>
  );
}
