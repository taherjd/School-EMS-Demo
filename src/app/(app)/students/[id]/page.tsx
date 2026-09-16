import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtAED, fmtDate, num, toISODate } from "@/lib/format";
import { ageCutoffDate, checkAgePlacement, formatEmiratesId, REQUIRED_STUDENT_DOCUMENTS, subjectAppliesToStudent } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Button, Card, DL, Field, Input, LinkButton, PageHeader, Select, Table, Td, Textarea, label, statusTone } from "@/components/ui";
import { addGuardian, enrolStudent, logIncident, saveIep, updateDocument, withdrawStudent } from "../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER");
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      grade: true,
      section: { include: { homeroomTeacher: true } },
      guardians: { include: { guardian: true } },
      documents: { orderBy: { type: "asc" } },
      attendance: { orderBy: { date: "desc" }, take: 60 },
      results: { include: { assessment: { include: { subject: true, term: true } } }, orderBy: { assessment: { date: "desc" } } },
      invoices: { include: { items: true, payments: true }, orderBy: { issueDate: "desc" } },
      ieps: { orderBy: { createdAt: "desc" } },
      incidents: { orderBy: { occurredAt: "desc" } },
      contracts: { include: { academicYear: true } },
    },
  });
  if (!student) notFound();
  const [school, year, subjects] = await Promise.all([
    prisma.school.findFirst(),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.subject.findMany({ where: { isKhdaMandatory: true } }),
  ]);
  const sections = year ? await prisma.section.findMany({ where: { academicYearId: year.id, gradeId: student.gradeId }, include: { _count: { select: { students: { where: { status: "ENROLLED" } } } } } }) : [];
  const ageCheck = school && year ? checkAgePlacement(student.dateOfBirth, student.grade.minAgeYears, ageCutoffDate(school.academicYearStart, year.startDate)) : null;
  const canEdit = session.role === "ADMIN" || session.role === "REGISTRAR";
  const canTeach = canEdit || session.role === "TEACHER";
  const canSeeFees = session.role === "ADMIN" || session.role === "ACCOUNTANT";

  const att = student.attendance;
  const present = att.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const attPct = att.length ? ((present / att.length) * 100).toFixed(1) : "—";
  const requiredSubjects = subjects.filter((s) => subjectAppliesToStudent(s.applicability, student));
  const activeIep = student.ieps.find((i) => i.status === "ACTIVE" || i.status === "UNDER_REVIEW") ?? student.ieps[0];
  const contract = year ? student.contracts.find((c) => c.academicYearId === year.id) : null;
  let ageTone: "error" | "warn" | "success" = "success";
  if (ageCheck?.tooYoung) ageTone = "error";
  else if (ageCheck?.needsKhdaApproval) ageTone = "warn";
  let visaLabel = "—";
  if (student.visaNo) visaLabel = `${student.visaNo} (exp. ${fmtDate(student.visaExpiry)})`;
  else if (student.isEmirati) visaLabel = "Not required";

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`${student.studentNo} · ${student.grade.name}${student.section ? ` – ${student.section.name}` : ""}${student.nameAr ? ` · ${student.nameAr}` : ""}`}
        actions={
          <>
            <Badge tone={statusTone(student.status)}>{label(student.status)}</Badge>
            {canEdit && <LinkButton href={`/students/${id}/edit`} variant="secondary">Edit</LinkButton>}
            {canEdit && <LinkButton href={`/compliance/contracts/${id}`} variant="secondary">{contract ? "Parent–School Contract" : "Generate contract"}</LinkButton>}
          </>
        }
      />

      {ageCheck && (
        <div className="mb-4">
          <Alert tone={ageTone}>KHDA age placement: {ageCheck.message}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-2">
          <DL items={[
            ["Date of birth", fmtDate(student.dateOfBirth)],
            ["Gender", label(student.gender)],
            ["Nationality", <>{student.nationality} {student.isEmirati && <Badge tone="green">Emirati</Badge>}</>],
            ["Emirates ID", student.emiratesId ? `${formatEmiratesId(student.emiratesId)} (exp. ${fmtDate(student.emiratesIdExpiry)})` : "—"],
            ["Passport", student.passportNo ? `${student.passportNo} (exp. ${fmtDate(student.passportExpiry)})` : "—"],
            ["Residence visa", visaLabel],
            ["Admission date", fmtDate(student.admissionDate)],
            ["Previous school", student.previousSchool ? `${student.previousSchool}${student.previousSchoolCountry ? `, ${student.previousSchoolCountry}` : ""}` : "—"],
            ["Homeroom teacher", student.section?.homeroomTeacher ? `${student.section.homeroomTeacher.firstName} ${student.section.homeroomTeacher.lastName}` : "—"],
            ["Emergency contact", student.emergencyContactName ? `${student.emergencyContactName} · ${student.emergencyContactPhone}` : "—"],
            ["Transport", student.usesSchoolTransport ? "School bus" : "Own"],
            ["Medical", student.medicalNotes ?? "—"],
            ...(student.withdrawalDate ? [["Withdrawn", `${fmtDate(student.withdrawalDate)} – ${student.withdrawalReason}`] as [string, string]] : []),
          ]} />
        </Card>
        <Card title="KHDA flags & mandatory subjects">
          <div className="mb-3 flex flex-wrap gap-1">
            {student.isMuslim ? <Badge tone="blue">Muslim – Islamic Education</Badge> : <Badge>Non-Muslim</Badge>}
            {student.arabicFirstLanguage ? <Badge tone="blue">Arabic A (first language)</Badge> : <Badge>Arabic B (additional language)</Badge>}
            {student.isStudentOfDetermination && <Badge tone="purple">Student of determination{student.sendCategory ? `: ${student.sendCategory}` : ""}</Badge>}
            {student.isGifted && <Badge tone="amber">Gifted & talented</Badge>}
            {student.isEAL && <Badge>EAL</Badge>}
          </div>
          <div className="text-xs font-medium uppercase text-gray-500">Required KHDA subjects</div>
          <ul className="mt-1 list-inside list-disc text-sm">
            {requiredSubjects.map((s) => <li key={s.id}>{s.name}</li>)}
          </ul>
          <div className="mt-4 text-xs font-medium uppercase text-gray-500">Attendance (last {att.length} days)</div>
          <div className="text-2xl font-semibold">{attPct}%</div>
        </Card>
      </div>

      {canEdit && student.status === "APPLICANT" && (
        <Card title="Enrol student" className="mt-6">
          <ActionForm action={enrolStudent} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="studentId" value={id} />
            <Field label="Section">
              <Select name="sectionId" required defaultValue="">
                <option value="">Select…</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{student.grade.name} – {s.name} ({s._count.students}/{s.capacity})</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="force" /> Enrol anyway (core documents pending)</label>
            <Button>Enrol</Button>
          </ActionForm>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Registration documents" actions={<span className="text-xs text-gray-500">Required for KHDA registration</span>}>
          <div className="space-y-2">
            {REQUIRED_STUDENT_DOCUMENTS.filter((t) => !(t === "VISA" && student.isEmirati)).map((type) => {
              const doc = student.documents.find((d) => d.type === type);
              const expired = doc?.expiryDate && doc.expiryDate < new Date();
              return (
                <ActionForm key={type} action={updateDocument} className="grid grid-cols-12 items-center gap-2 border-b border-gray-100 pb-2 text-sm">
                  <input type="hidden" name="studentId" value={id} />
                  <input type="hidden" name="type" value={type} />
                  <div className="col-span-4 font-medium">{label(type)} {expired && <Badge tone="red">expired</Badge>}</div>
                  <div className="col-span-3">
                    <Select name="status" defaultValue={doc?.status ?? "MISSING"} disabled={!canEdit}>
                      {["MISSING", "RECEIVED", "VERIFIED", "EXPIRED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-3"><Input name="expiryDate" type="date" defaultValue={doc?.expiryDate ? toISODate(doc.expiryDate) : ""} disabled={!canEdit} /></div>
                  <div className="col-span-2">{canEdit && <Button variant="secondary" className="w-full justify-center">Save</Button>}</div>
                </ActionForm>
              );
            })}
          </div>
        </Card>

        <Card title="Guardians">
          <Table head={["Name", "Relationship", "Contact", "Portal"]}>
            {student.guardians.map(({ guardian, isPrimary }) => (
              <tr key={guardian.id}>
                <Td>{guardian.firstName} {guardian.lastName} {isPrimary && <Badge tone="green">primary</Badge>}</Td>
                <Td>{guardian.relationship}</Td>
                <Td>{guardian.phone}{guardian.email && <div className="text-gray-500">{guardian.email}</div>}</Td>
                <Td>{guardian.userId ? <Badge tone="green">active</Badge> : <Badge>none</Badge>}</Td>
              </tr>
            ))}
          </Table>
          {canEdit && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-brand">Add guardian</summary>
              <ActionForm action={addGuardian} className="mt-2 grid gap-2 md:grid-cols-3">
                <input type="hidden" name="studentId" value={id} />
                <Input name="firstName" placeholder="First name" required />
                <Input name="lastName" placeholder="Last name" />
                <Select name="relationship"><option>Father</option><option>Mother</option><option>Legal Guardian</option></Select>
                <Input name="phone" placeholder="Mobile" required />
                <Input name="email" type="email" placeholder="Email" />
                <Input name="emiratesId" placeholder="Emirates ID" />
                <label className="flex items-center gap-2"><input type="checkbox" name="isPrimary" /> Primary</label>
                <Button variant="secondary">Add</Button>
              </ActionForm>
            </details>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Assessment results">
          <Table head={["Assessment", "Subject", "Term", "Marks", "Grade"]} empty="No results recorded">
            {student.results.map((r) => (
              <tr key={r.id}>
                <Td>{r.assessment.name}</Td>
                <Td>{r.assessment.subject.name}</Td>
                <Td>{r.assessment.term.name}</Td>
                <Td>{num(r.marks)} / {r.assessment.maxMarks}</Td>
                <Td>{r.gradeLabel ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Recent attendance">
          <div className="flex flex-wrap gap-1">
            {att.slice(0, 40).map((a) => (
              <span key={a.id} title={`${fmtDate(a.date)} – ${label(a.status)}`} className={`h-6 w-6 rounded text-center text-xs leading-6 ${{ PRESENT: "bg-emerald-200", LATE: "bg-amber-200", ABSENT: "bg-red-200", EXCUSED: "bg-sky-200", MEDICAL: "bg-violet-200" }[a.status]}`}>
                {a.status[0]}
              </span>
            ))}
            {att.length === 0 && <span className="text-sm text-gray-500">No attendance recorded</span>}
          </div>
        </Card>
      </div>

      {canSeeFees && (
        <Card title="Fee invoices" className="mt-6">
          <Table head={["Invoice", "Term", "Due", "Total", "Paid", "Status"]} empty="No invoices">
            {student.invoices.map((inv) => {
              const total = inv.items.reduce((a, i) => a + num(i.amount), 0);
              const paid = inv.payments.reduce((a, p) => a + num(p.amount), 0);
              return (
                <tr key={inv.id}>
                  <Td><Link href={`/fees/invoices/${inv.id}`} className="text-brand hover:underline">{inv.invoiceNo}</Link></Td>
                  <Td>{inv.termId ? "Term invoice" : "Ad hoc"}</Td>
                  <Td>{fmtDate(inv.dueDate)}</Td>
                  <Td>{fmtAED(total)}</Td>
                  <Td>{fmtAED(paid)}</Td>
                  <Td><Badge tone={statusTone(inv.status)}>{label(inv.status)}</Badge></Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Individual Education Plan (inclusion)">
          {activeIep && (
            <div className="mb-3 text-sm">
              <Badge tone={statusTone(activeIep.status)}>{label(activeIep.status)}</Badge> Review due {fmtDate(activeIep.reviewDate)}{activeIep.coordinator && ` · ${activeIep.coordinator}`}
            </div>
          )}
          {canTeach ? (
            <ActionForm action={saveIep} className="space-y-2 text-sm">
              <input type="hidden" name="studentId" value={id} />
              {activeIep && <input type="hidden" name="iepId" value={activeIep.id} />}
              <Field label="Identified needs"><Textarea name="needs" rows={2} defaultValue={activeIep?.needs ?? ""} /></Field>
              <Field label="Targets"><Textarea name="targets" rows={2} defaultValue={activeIep?.targets ?? ""} /></Field>
              <Field label="Provisions / accommodations"><Textarea name="provisions" rows={2} defaultValue={activeIep?.provisions ?? ""} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Status"><Select name="status" defaultValue={activeIep?.status ?? "DRAFT"}>{["DRAFT", "ACTIVE", "UNDER_REVIEW", "CLOSED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
                <Field label="Review date"><Input type="date" name="reviewDate" defaultValue={activeIep ? toISODate(activeIep.reviewDate) : ""} /></Field>
                <Field label="Coordinator"><Input name="coordinator" defaultValue={activeIep?.coordinator ?? ""} /></Field>
              </div>
              <Button variant="secondary">{activeIep ? "Update IEP" : "Create IEP"}</Button>
            </ActionForm>
          ) : (
            <p className="text-sm text-gray-600">{activeIep ? activeIep.provisions : "No IEP on file."}</p>
          )}
        </Card>

        <Card title="Wellbeing, safeguarding & behaviour log">
          <ul className="mb-3 divide-y divide-gray-100 text-sm">
            {student.incidents.map((i) => (
              <li key={i.id} className="py-2">
                <div className="flex items-center gap-2"><Badge tone={statusTone(i.severity)}>{label(i.severity)}</Badge><span className="font-medium">{label(i.type)}</span><span className="text-gray-500">{fmtDate(i.occurredAt)}</span>{i.resolved && <Badge tone="green">resolved</Badge>}</div>
                <div className="text-gray-700">{i.description}</div>
                {i.actionTaken && <div className="text-gray-500">Action: {i.actionTaken}</div>}
              </li>
            ))}
            {student.incidents.length === 0 && <li className="py-2 text-gray-500">No incidents logged.</li>}
          </ul>
          {canTeach && (
            <details className="text-sm">
              <summary className="cursor-pointer text-brand">Log incident</summary>
              <ActionForm action={logIncident} className="mt-2 grid gap-2 md:grid-cols-2">
                <input type="hidden" name="studentId" value={id} />
                <Select name="type">{["BEHAVIOUR", "SAFEGUARDING", "BULLYING", "MEDICAL", "WELLBEING", "OTHER"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
                <Select name="severity">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
                <Input type="date" name="occurredAt" required defaultValue={toISODate(new Date())} />
                <label className="flex items-center gap-2"><input type="checkbox" name="resolved" /> Resolved</label>
                <Textarea name="description" placeholder="What happened" required className="md:col-span-2" rows={2} />
                <Textarea name="actionTaken" placeholder="Action taken / parents informed" className="md:col-span-2" rows={2} />
                <Button variant="secondary">Log</Button>
              </ActionForm>
            </details>
          )}
        </Card>
      </div>

      {canEdit && (student.status === "ENROLLED" || student.status === "APPLICANT") && (
        <Card title="Withdrawal / transfer" className="mt-6">
          <ActionForm action={withdrawStudent} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="studentId" value={id} />
            <Field label="Last day"><Input type="date" name="withdrawalDate" required /></Field>
            <Field label="Outcome"><Select name="newStatus"><option value="WITHDRAWN">Withdrawn</option><option value="TRANSFERRED">Transferred (TC issued)</option></Select></Field>
            <Field label="Reason" className="min-w-64"><Input name="withdrawalReason" required placeholder="e.g. Relocation outside UAE" /></Field>
            <Button variant="danger">Withdraw</Button>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
