import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtAED, fmtDate, num, toISODate } from "@/lib/format";
import { computeTermRefund } from "@/lib/khda";
import { Alert, Button, Card, DL, Field, Input, PageHeader, Select } from "@/components/ui";

export default async function RefundPage({ searchParams }: { searchParams: Promise<{ student?: string; date?: string }> }) {
  await requireRole("ADMIN", "ACCOUNTANT");
  const sp = await searchParams;
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { number: "asc" } } } });
  const students = await prisma.student.findMany({ where: { status: { in: ["ENROLLED", "WITHDRAWN", "TRANSFERRED"] } }, include: { grade: true }, orderBy: { lastName: "asc" } });
  const student = sp.student ? students.find((s) => s.id === sp.student) : null;
  const when = sp.date ? new Date(`${sp.date}T00:00:00.000Z`) : null;
  let result: ReturnType<typeof computeTermRefund> | null = null;
  let termName = "";
  let error = "";
  if (student && when && year) {
    const term = year.terms.find((t) => when >= t.startDate && when <= t.endDate) ?? year.terms.find((t) => when < t.startDate);
    const fs = await prisma.feeStructure.findUnique({ where: { academicYearId_gradeId: { academicYearId: year.id, gradeId: student.gradeId } } });
    if (!term) error = "Date is outside the academic year.";
    else if (!fs) error = "No fee structure for the student's grade.";
    else {
      const annual = num(fs.annualTuition);
      termName = term.name;
      result = computeTermRefund({ annualTuition: annual, termFee: (annual * term.feeSharePct) / 100, termStart: term.startDate, withdrawalDate: when < term.startDate ? term.startDate : when });
    }
  }
  return (
    <>
      <PageHeader title="Refund calculator" subtitle="KHDA withdrawal refund policy for tuition fees paid in advance" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inputs">
          <form className="space-y-3">
            <Field label="Student"><Select name="student" defaultValue={sp.student ?? ""}><option value="">Select…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} – {s.grade.name}</option>)}</Select></Field>
            <Field label="Last day of attendance"><Input type="date" name="date" defaultValue={sp.date ?? toISODate(new Date())} /></Field>
            <Button>Calculate</Button>
          </form>
          <div className="mt-4 text-xs text-gray-600">
            <p className="font-medium">KHDA rule (tuition paid for the term):</p>
            <ul className="list-inside list-disc">
              <li>Attended two weeks or less → one month’s fee retained</li>
              <li>More than two weeks and up to one month → two months’ fee retained</li>
              <li>More than one month → full term fee retained</li>
            </ul>
            <p className="mt-1">One month’s fee = annual tuition ÷ 10. Registration deposits are refundable only in the cases set out in the KHDA fee framework.</p>
          </div>
        </Card>
        <Card title="Result">
          {error && <Alert tone="error">{error}</Alert>}
          {result && student ? (
            <DL items={[
              ["Student", `${student.firstName} ${student.lastName}`],
              ["Term", termName],
              ["Days from term start", String(result.daysAttended)],
              ["Rule applied", result.rule],
              ["Monthly fee (annual ÷ 10)", fmtAED(result.monthlyFee)],
              ["School retains", fmtAED(result.retained)],
              ["Refund due to parent", fmtAED(result.refund)],
              ["Withdrawal date", when ? fmtDate(when) : "—"],
            ]} />
          ) : !error && <p className="text-sm text-gray-500">Choose a student and date.</p>}
        </Card>
      </div>
    </>
  );
}
