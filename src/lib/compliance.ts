import "server-only";
import { prisma } from "./db";
import { attendanceBand, REQUIRED_STUDENT_DOCUMENTS, subjectAppliesToStudent, MAX_REGISTRATION_DEPOSIT_RATIO } from "./khda";
import { num } from "./format";

export type Finding = { severity: "HIGH" | "MEDIUM" | "LOW"; area: string; message: string; href?: string };

export async function currentYear() {
  return prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { number: "asc" } } } });
}

export async function attendanceSummary(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.attendance.groupBy({ by: ["status"], where: { date: { gte: since } }, _count: { _all: true } });
  const total = rows.reduce((a, r) => a + r._count._all, 0);
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").reduce((a, r) => a + r._count._all, 0);
  const pct = total ? +((present / total) * 100).toFixed(1) : 0;
  return { total, present, pct, band: attendanceBand(pct) };
}

export async function expiringDocuments(withinDays = 60) {
  const limit = new Date(Date.now() + withinDays * 86_400_000);
  const [docs, staff] = await Promise.all([
    prisma.studentDocument.findMany({
      where: { student: { status: "ENROLLED" }, OR: [{ expiryDate: { lte: limit } }, { status: "EXPIRED" }] },
      include: { student: { select: { id: true, firstName: true, lastName: true, studentNo: true } } },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.staff.findMany({
      where: { leaveDate: null, OR: [{ visaExpiry: { lte: limit } }, { emiratesIdExpiry: { lte: limit } }, { licenceExpiry: { lte: limit } }, { licenceStatus: { in: ["PENDING", "EXPIRED"] } }] },
      select: { id: true, firstName: true, lastName: true, visaExpiry: true, emiratesIdExpiry: true, licenceExpiry: true, licenceStatus: true, isTeaching: true },
    }),
  ]);
  return { docs, staff };
}

export async function missingDocuments() {
  const students = await prisma.student.findMany({ where: { status: "ENROLLED" }, select: { id: true, firstName: true, lastName: true, studentNo: true, isEmirati: true, documents: { select: { type: true, status: true } } } });
  return students
    .map((s) => {
      const missing = REQUIRED_STUDENT_DOCUMENTS.filter((t) => {
        if (t === "VISA" && s.isEmirati) return false;
        const doc = s.documents.find((d) => d.type === t);
        return !doc || doc.status === "MISSING";
      });
      return { ...s, missing };
    })
    .filter((s) => s.missing.length > 0);
}

/** Checks mandatory subject weekly periods per section against the curriculum requirement table. */
export async function curriculumCompliance(academicYearId: string) {
  const sections = await prisma.section.findMany({
    where: { academicYearId },
    include: {
      grade: { include: { curriculumRequirements: { include: { subject: true } } } },
      assignments: { include: { subject: true } },
      students: { where: { status: "ENROLLED" }, select: { isMuslim: true, arabicFirstLanguage: true } },
    },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
  const issues: { sectionId: string; section: string; subject: string; required: number; actual: number }[] = [];
  for (const sec of sections) {
    for (const req of sec.grade.curriculumRequirements) {
      const anyStudentNeedsIt = sec.students.some((st) => subjectAppliesToStudent(req.subject.applicability, st));
      if (!anyStudentNeedsIt) continue;
      const actual = sec.assignments.find((a) => a.subjectId === req.subjectId)?.weeklyPeriods ?? 0;
      if (actual < req.minWeeklyPeriods) {
        issues.push({ sectionId: sec.id, section: `${sec.grade.name} ${sec.name}`, subject: req.subject.name, required: req.minWeeklyPeriods, actual });
      }
    }
  }
  return { sections: sections.length, issues };
}

export async function feeCompliance(academicYearId: string) {
  const structures = await prisma.feeStructure.findMany({ where: { academicYearId }, include: { grade: true } });
  const depositIssues = structures.filter((f) => num(f.registrationDeposit) > num(f.annualTuition) * MAX_REGISTRATION_DEPOSIT_RATIO + 0.005).map((f) => f.grade.name);
  const missingApproval = structures.filter((f) => !f.khdaApprovalRef).map((f) => f.grade.name);
  return { depositIssues, missingApproval, count: structures.length };
}

export async function inclusionCompliance() {
  const sod = await prisma.student.findMany({ where: { status: "ENROLLED", isStudentOfDetermination: true }, select: { id: true, firstName: true, lastName: true, ieps: { where: { status: { in: ["ACTIVE", "UNDER_REVIEW"] } }, select: { id: true, reviewDate: true } } } });
  const withoutIep = sod.filter((s) => s.ieps.length === 0);
  const overdueReview = sod.filter((s) => s.ieps.some((i) => i.reviewDate < new Date()));
  return { total: sod.length, withoutIep, overdueReview };
}

export async function contractCompliance(academicYearId: string) {
  const enrolled = await prisma.student.count({ where: { status: "ENROLLED" } });
  const signed = await prisma.parentSchoolContract.count({ where: { academicYearId, status: "SIGNED" } });
  return { enrolled, signed, unsigned: enrolled - signed };
}

export async function collectFindings(): Promise<Finding[]> {
  const year = await currentYear();
  if (!year) return [{ severity: "HIGH", area: "Setup", message: "No current academic year configured.", href: "/settings" }];
  const [exp, missing, curr, fee, incl, contracts, att] = await Promise.all([
    expiringDocuments(),
    missingDocuments(),
    curriculumCompliance(year.id),
    feeCompliance(year.id),
    inclusionCompliance(),
    contractCompliance(year.id),
    attendanceSummary(),
  ]);
  const f: Finding[] = [];
  const expired = exp.docs.filter((d) => d.status === "EXPIRED" || (d.expiryDate && d.expiryDate < new Date()));
  if (expired.length) f.push({ severity: "HIGH", area: "Student records", message: `${expired.length} student document(s) have expired.`, href: "/compliance#documents" });
  const soon = exp.docs.length - expired.length;
  if (soon) f.push({ severity: "MEDIUM", area: "Student records", message: `${soon} student document(s) expire within 60 days.`, href: "/compliance#documents" });
  if (missing.length) f.push({ severity: "HIGH", area: "KHDA registration", message: `${missing.length} enrolled student(s) are missing required registration documents.`, href: "/compliance#documents" });
  const unlicensed = exp.staff.filter((s) => s.isTeaching && (s.licenceStatus === "PENDING" || s.licenceStatus === "EXPIRED"));
  if (unlicensed.length) f.push({ severity: "MEDIUM", area: "Teacher licensing", message: `${unlicensed.length} teaching staff without a valid UAE teacher licence.`, href: "/staff" });
  const staffDocs = exp.staff.filter((s) => (s.visaExpiry && s.visaExpiry < new Date(Date.now() + 60 * 86_400_000)) || (s.emiratesIdExpiry && s.emiratesIdExpiry < new Date(Date.now() + 60 * 86_400_000)));
  if (staffDocs.length) f.push({ severity: "MEDIUM", area: "Staff records", message: `${staffDocs.length} staff member(s) have a visa or Emirates ID expiring within 60 days.`, href: "/staff" });
  if (curr.issues.length) f.push({ severity: "HIGH", area: "Curriculum", message: `${curr.issues.length} section(s) timetable a KHDA-mandatory subject below the minimum weekly periods.`, href: "/compliance#curriculum" });
  if (fee.depositIssues.length) f.push({ severity: "HIGH", area: "Fees", message: `Registration deposit exceeds 10% of tuition for: ${fee.depositIssues.join(", ")}.`, href: "/fees" });
  if (fee.missingApproval.length) f.push({ severity: "MEDIUM", area: "Fees", message: `No KHDA fee approval reference recorded for: ${fee.missingApproval.join(", ")}.`, href: "/fees" });
  if (incl.withoutIep.length) f.push({ severity: "HIGH", area: "Inclusion", message: `${incl.withoutIep.length} student(s) of determination without an active IEP.`, href: "/compliance#inclusion" });
  if (incl.overdueReview.length) f.push({ severity: "MEDIUM", area: "Inclusion", message: `${incl.overdueReview.length} IEP review(s) overdue.`, href: "/compliance#inclusion" });
  if (contracts.unsigned > 0) f.push({ severity: "MEDIUM", area: "Parent–School Contract", message: `${contracts.unsigned} enrolled student(s) without a signed Parent–School Contract for ${year.name}.`, href: "/compliance#contracts" });
  if (att.total && att.pct < 94) f.push({ severity: "MEDIUM", area: "Attendance", message: `30-day attendance is ${att.pct}% (DSIB band: ${att.band.replace("_", " ").toLowerCase()}).`, href: "/attendance" });
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return f.sort((a, b) => order[a.severity] - order[b.severity]);
}
