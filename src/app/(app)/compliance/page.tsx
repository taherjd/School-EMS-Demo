import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { collectFindings, contractCompliance, curriculumCompliance, currentYear, expiringDocuments, inclusionCompliance, missingDocuments } from "@/lib/compliance";
import { fmtDate } from "@/lib/format";
import { DSIB_RATING_LABEL, DSIB_STANDARDS } from "@/lib/khda";
import { Badge, Card, LinkButton, PageHeader, Stat, Table, Td, label, statusTone } from "@/components/ui";

export default async function CompliancePage() {
  await requireRole("ADMIN", "REGISTRAR", "ACCOUNTANT");
  const year = await currentYear();
  const [findings, exp, missing, sef, school] = await Promise.all([
    collectFindings(),
    expiringDocuments(),
    missingDocuments(),
    year ? prisma.selfEvaluation.findMany({ where: { academicYearId: year.id } }) : [],
    prisma.school.findFirst(),
  ]);
  const curr = year ? await curriculumCompliance(year.id) : { issues: [], sections: 0 };
  const incl = await inclusionCompliance();
  const contracts = year ? await contractCompliance(year.id) : { enrolled: 0, signed: 0, unsigned: 0 };
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const sefByStandard = DSIB_STANDARDS.map((s) => {
    const rows = sef.filter((r) => r.standard === s.number);
    const order = ["OUTSTANDING", "VERY_GOOD", "GOOD", "ACCEPTABLE", "WEAK", "VERY_WEAK"];
    const worst = rows.map((r) => r.rating).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
    return { ...s, rated: rows.length, worst };
  });

  return (
    <>
      <PageHeader title="KHDA compliance" subtitle={`Readiness checks for KHDA registration, DSIB inspection and the fee framework · ${year?.name ?? ""}`} actions={<><LinkButton href="/compliance/sef" variant="secondary">DSIB self-evaluation</LinkButton><LinkButton href="/api/export/students" variant="secondary">Export student data (CSV)</LinkButton></>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Open findings" value={findings.length} hint={`${high} high severity`} tone={high ? "bad" : findings.length ? "warn" : "good"} />
        <Stat label="Students missing documents" value={missing.length} tone={missing.length ? "warn" : "good"} />
        <Stat label="Curriculum minimum breaches" value={curr.issues.length} hint={`${curr.sections} sections checked`} tone={curr.issues.length ? "bad" : "good"} />
        <Stat label="Contracts signed" value={`${contracts.signed} / ${contracts.enrolled}`} tone={contracts.unsigned ? "warn" : "good"} />
      </div>

      <Card title="Findings" className="mb-6">
        <Table head={["Severity", "Area", "Finding"]} empty="No open findings">
          {findings.map((f, i) => (
            <tr key={i}>
              <Td><Badge tone={f.severity === "HIGH" ? "red" : f.severity === "MEDIUM" ? "amber" : "gray"}>{f.severity}</Badge></Td>
              <Td>{f.area}</Td>
              <Td>{f.href ? <Link href={f.href} className="hover:underline">{f.message}</Link> : f.message}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <div id="documents" className="grid gap-6 lg:grid-cols-2">
        <Card title="Student documents: missing">
          <Table head={["Student", "Missing"]} empty="All enrolled students have their required documents">
            {missing.map((s) => (
              <tr key={s.id}><Td><Link href={`/students/${s.id}`} className="text-brand hover:underline">{s.firstName} {s.lastName}</Link> <span className="text-gray-500">{s.studentNo}</span></Td><Td>{s.missing.map((m) => <Badge key={m} tone="red">{label(m)}</Badge>)}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Student documents: expiring within 60 days">
          <Table head={["Student", "Document", "Expiry", "Status"]} empty="Nothing expiring soon">
            {exp.docs.map((d) => (
              <tr key={d.id}><Td><Link href={`/students/${d.student.id}`} className="text-brand hover:underline">{d.student.firstName} {d.student.lastName}</Link></Td><Td>{label(d.type)}</Td><Td>{fmtDate(d.expiryDate)}</Td><Td><Badge tone={statusTone(d.status)}>{label(d.status)}</Badge></Td></tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Staff: licences and documents needing action">
          <Table head={["Staff", "Licence", "Licence expiry", "Visa expiry", "Emirates ID expiry"]} empty="No staff actions">
            {exp.staff.map((s) => (
              <tr key={s.id}><Td><Link href={`/staff/${s.id}`} className="text-brand hover:underline">{s.firstName} {s.lastName}</Link></Td><Td><Badge tone={statusTone(s.licenceStatus)}>{label(s.licenceStatus)}</Badge></Td><Td>{fmtDate(s.licenceExpiry)}</Td><Td>{fmtDate(s.visaExpiry)}</Td><Td>{fmtDate(s.emiratesIdExpiry)}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Curriculum: KHDA-mandatory subject minimums" className="scroll-mt-4">
          <div id="curriculum" />
          <Table head={["Section", "Subject", "Timetabled", "Minimum"]} empty="All sections meet the minimum weekly periods">
            {curr.issues.map((i, idx) => (
              <tr key={idx}><Td><Link href={`/academics/sections/${i.sectionId}`} className="text-brand hover:underline">{i.section}</Link></Td><Td>{i.subject}</Td><Td className="text-red-700">{i.actual}</Td><Td>{i.required}</Td></tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Inclusion (students of determination)">
          <div id="inclusion" />
          <p className="text-sm">{incl.total} on register · {incl.withoutIep.length} without an active IEP · {incl.overdueReview.length} overdue review(s)</p>
          <ul className="mt-2 text-sm">
            {incl.withoutIep.map((s) => <li key={s.id}><Link href={`/students/${s.id}`} className="text-red-700 hover:underline">{s.firstName} {s.lastName}</Link> – no IEP</li>)}
            {incl.overdueReview.map((s) => <li key={s.id}><Link href={`/students/${s.id}`} className="text-amber-700 hover:underline">{s.firstName} {s.lastName}</Link> – review overdue</li>)}
          </ul>
        </Card>
        <Card title="Parent–School Contracts">
          <div id="contracts" />
          <p className="text-sm">{contracts.signed} of {contracts.enrolled} enrolled students have a signed contract for {year?.name}.</p>
          <p className="mt-2 text-xs text-gray-600">Generate and record contracts from each student’s profile.</p>
        </Card>
        <Card title="DSIB self-evaluation summary">
          <p className="mb-2 text-xs text-gray-600">Last published rating: {school?.lastDsibRating ? DSIB_RATING_LABEL[school.lastDsibRating] : "not set"}</p>
          <ul className="space-y-1 text-sm">
            {sefByStandard.map((s) => (
              <li key={s.number} className="flex items-center justify-between gap-2">
                <span>{s.number}. {s.title}</span>
                {s.worst ? <Badge tone={statusTone(s.worst)}>{DSIB_RATING_LABEL[s.worst]}</Badge> : <Badge>not rated</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
