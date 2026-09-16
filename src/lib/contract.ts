import { fmtAED, fmtDate } from "./format";

export function renderContract(p: {
  schoolName: string; khdaSchoolId: string | null; yearName: string; studentName: string; studentNo: string; grade: string;
  guardianName: string; tuition: number; deposit: number; terms: { name: string; pct: number; start: Date }[]; transport: number | null;
}) {
  const lines = [
    `PARENT–SCHOOL CONTRACT · ${p.yearName}`,
    `Issued under the KHDA Parent–School Contract framework (Dubai).`,
    ``,
    `School: ${p.schoolName}${p.khdaSchoolId ? ` (KHDA permit ${p.khdaSchoolId})` : ""}`,
    `Student: ${p.studentName} (${p.studentNo}), ${p.grade}`,
    `Parent / guardian: ${p.guardianName}`,
    ``,
    `1. FEES`,
    `1.1 The KHDA-approved annual tuition fee for ${p.grade} is ${fmtAED(p.tuition)}.`,
    `1.2 Tuition is payable in ${p.terms.length} instalments: ${p.terms.map((t) => `${t.name} ${t.pct}% (${fmtAED((p.tuition * t.pct) / 100)}), due before ${fmtDate(t.start)}`).join("; ")}.`,
    `1.3 A registration / re-registration deposit of ${fmtAED(p.deposit)} (not exceeding 10% of tuition) secures the place and is deducted from the first instalment.`,
    p.transport ? `1.4 Optional school transport: ${fmtAED(p.transport)} per year, billed with tuition instalments.` : `1.4 School transport is not selected.`,
    `1.5 No other charges will be levied without prior KHDA approval and parent consent.`,
    ``,
    `2. WITHDRAWAL AND REFUNDS`,
    `2.1 Where the student withdraws during a term after fees are paid: attendance of two weeks or less – one month's fee is retained; more than two weeks and up to one month – two months' fee is retained; more than one month – the full term's fee is retained.`,
    `2.2 The registration deposit is refundable only in the circumstances set out by KHDA (e.g. the school is unable to offer the place, or the family relocates before the year begins with evidence).`,
    `2.3 A Transfer Certificate will be issued via the KHDA system once all outstanding fees are settled.`,
    ``,
    `3. SCHOOL OBLIGATIONS`,
    `3.1 Deliver the curriculum approved by KHDA, including Arabic, Islamic Education (for Muslim students), UAE Social Studies and Moral, Social and Cultural Studies as required.`,
    `3.2 Provide a safe environment, safeguarding, inclusion support for students of determination, and regular reporting on attainment, progress and attendance.`,
    `3.3 Handle personal data in line with UAE Federal Decree-Law No. 45 of 2021 (Personal Data Protection).`,
    ``,
    `4. PARENT OBLIGATIONS`,
    `4.1 Ensure regular attendance and punctuality (KHDA-registered school week Monday–Friday).`,
    `4.2 Provide valid Emirates ID, passport, residence visa (where applicable), immunisation record and previous school documents.`,
    `4.3 Inform the school promptly of changes to contact details, medical needs or custody arrangements.`,
    `4.4 Respect the school's behaviour, uniform and communication policies.`,
    ``,
    `5. DISPUTES`,
    `5.1 Concerns are raised first with the school; unresolved matters may be escalated to KHDA's Compliance and Resolution Commission.`,
    ``,
    `Signed for the school: ______________________   Date: ____________`,
    `Signed by parent / guardian: ______________________   Date: ____________`,
  ];
  return lines.join("\n");
}

