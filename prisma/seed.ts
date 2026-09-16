import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { GRADE_CATALOGUE, MANDATORY_SUBJECTS, DSIB_STANDARDS, DEFAULT_TERM_FEE_SPLIT } from "../src/lib/khda";
import { gradeFor } from "../src/lib/grading";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

/** Generates a Luhn-valid Emirates ID for demo data. */
function fakeEmiratesId(seed: number) {
  const body = `784${1980 + (seed % 40)}${String(1000000 + ((seed * 7919) % 8999999)).padStart(7, "0")}`; // 14 digits
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(body[i]);
    if ((15 - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return body + String((10 - (sum % 10)) % 10);
}

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

function visaStatus(emirati: boolean, n: number): "VERIFIED" | "EXPIRED" {
  if (!emirati && n === 7) return "EXPIRED";
  return "VERIFIED";
}
function transferCertStatus(n: number): "VERIFIED" | "RECEIVED" | "MISSING" {
  if (n <= 2) return "VERIFIED";
  if (n === 9) return "MISSING";
  return "RECEIVED";
}
function demoPaidAmount(inv: number, total: number) {
  if (inv % 3 === 0) return total;
  if (inv % 3 === 1) return Math.round(total / 2);
  return 0;
}
function invoiceStatus(paid: number, total: number): "PAID" | "PARTIALLY_PAID" | "ISSUED" {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // School
  const school = await prisma.school.create({
    data: {
      name: "Al Noor International School",
      nameAr: "مدرسة النور الدولية",
      khdaSchoolId: "KHDA-DXB-0000",
      curriculum: "UK",
      academicYearStart: "SEPTEMBER",
      address: "Al Barsha, Dubai, UAE",
      phone: "+971 4 000 0000",
      email: "info@alnoor.example",
      principalName: "Dr. Sara Al Marzooqi",
      feeFrameworkRef: "FF-2026-0001",
      lastDsibRating: "GOOD",
    },
  });

  // Academic year and terms
  const year = await prisma.academicYear.create({
    data: {
      name: "2026-2027",
      startDate: d("2026-08-31"),
      endDate: d("2027-06-30"),
      isCurrent: true,
      terms: {
        create: [
          { number: 1, name: "Term 1", startDate: d("2026-08-31"), endDate: d("2026-12-11"), feeSharePct: DEFAULT_TERM_FEE_SPLIT[0] },
          { number: 2, name: "Term 2", startDate: d("2027-01-04"), endDate: d("2027-03-26"), feeSharePct: DEFAULT_TERM_FEE_SPLIT[1] },
          { number: 3, name: "Term 3", startDate: d("2027-04-12"), endDate: d("2027-06-30"), feeSharePct: DEFAULT_TERM_FEE_SPLIT[2] },
        ],
      },
    },
    include: { terms: true },
  });

  // Grades
  const grades = await prisma.grade.createManyAndReturn({ data: GRADE_CATALOGUE[school.curriculum] });
  const gradeByName = Object.fromEntries(grades.map((g) => [g.name, g]));

  // Subjects: mandatory KHDA + core
  for (const s of MANDATORY_SUBJECTS) {
    const subject = await prisma.subject.create({
      data: { code: s.code, name: s.name, nameAr: s.nameAr, isKhdaMandatory: true, applicability: s.applicability },
    });
    for (const g of grades) {
      const min = s.minWeeklyPeriods[g.phase];
      if (min) await prisma.curriculumRequirement.create({ data: { subjectId: subject.id, gradeId: g.id, minWeeklyPeriods: min } });
    }
  }
  const core = [
    ["ENG", "English", "اللغة الإنجليزية"],
    ["MAT", "Mathematics", "الرياضيات"],
    ["SCI", "Science", "العلوم"],
    ["PE", "Physical Education", "التربية البدنية"],
    ["ICT", "Computing", "الحوسبة"],
  ];
  for (const [code, name, nameAr] of core) await prisma.subject.create({ data: { code, name, nameAr } });
  const subjects = await prisma.subject.findMany();
  const subj = (code: string) => subjects.find((s) => s.code === code)!;

  // Users + staff
  const admin = await prisma.user.create({ data: { email: "admin@school.test", passwordHash, name: "System Admin", role: "ADMIN" } });
  await prisma.user.create({ data: { email: "registrar@school.test", passwordHash, name: "Fatima Registrar", role: "REGISTRAR" } });
  await prisma.user.create({ data: { email: "accounts@school.test", passwordHash, name: "Omar Accountant", role: "ACCOUNTANT" } });

  const teacherSpecs = [
    { first: "Aisha", last: "Khan", email: "aisha.khan@school.test", pos: "Class Teacher", nat: "Pakistan", lic: "LICENSED" as const },
    { first: "James", last: "Whitfield", email: "james.w@school.test", pos: "Head of Primary", nat: "United Kingdom", lic: "LICENSED" as const },
    { first: "Mariam", last: "Al Hashimi", email: "mariam.h@school.test", pos: "Arabic & Islamic Teacher", nat: "United Arab Emirates", lic: "PROVISIONAL" as const },
    { first: "Priya", last: "Nair", email: "priya.n@school.test", pos: "Inclusion Champion", nat: "India", lic: "PENDING" as const },
  ];
  const staff = [];
  let i = 1;
  for (const t of teacherSpecs) {
    const user = await prisma.user.create({ data: { email: t.email, passwordHash, name: `${t.first} ${t.last}`, role: "TEACHER" } });
    staff.push(
      await prisma.staff.create({
        data: {
          userId: user.id,
          staffNo: `STF-${String(i).padStart(4, "0")}`,
          firstName: t.first,
          lastName: t.last,
          gender: t.first === "James" ? "MALE" : "FEMALE",
          nationality: t.nat,
          emiratesId: fakeEmiratesId(100 + i),
          emiratesIdExpiry: d(`202${7 + (i % 3)}-0${1 + (i % 9)}-15`),
          passportNo: `P${1000000 + i}`,
          passportExpiry: d("2030-01-01"),
          visaExpiry: d(i === 3 ? "2026-10-05" : "2028-03-01"),
          position: t.pos,
          highestQualification: "BEd / BA (Hons)",
          teachingQualification: "PGCE",
          khdaApprovalRef: `KTA-${2026}-${100 + i}`,
          licenceStatus: t.lic,
          licenceNo: t.lic === "PENDING" ? null : `TLS-${50000 + i}`,
          licenceExpiry: t.lic === "PENDING" ? null : d(i === 1 ? "2026-11-30" : "2029-08-31"),
          joinDate: d(`202${i}-08-25`),
          phone: `+971 50 000 00${i}0`,
        },
      }),
    );
    i++;
  }

  // Sections
  const sectionSpecs = [
    ["FS2", "A", 0],
    ["Year 1", "A", 0],
    ["Year 1", "B", 1],
    ["Year 4", "A", 1],
    ["Year 7", "A", 2],
    ["Year 10", "A", 2],
  ] as const;
  const sections = [];
  for (const [g, name, tIdx] of sectionSpecs) {
    sections.push(
      await prisma.section.create({
        data: { gradeId: gradeByName[g].id, academicYearId: year.id, name, capacity: 25, homeroomTeacherId: staff[tIdx].id },
        include: { grade: true },
      }),
    );
  }

  // Teaching assignments + timetable for Year 1 A and Year 4 A
  const assignmentPlan: [string, string, number, number][] = [
    ["ENG", "Year 1", 1, 8],
    ["MAT", "Year 1", 1, 6],
    ["ARA-B", "Year 1", 2, 4],
    ["ISL", "Year 1", 2, 2],
    ["MSC", "Year 1", 0, 1],
    ["ENG", "Year 4", 1, 7],
    ["MAT", "Year 4", 1, 6],
    ["ARA-B", "Year 4", 2, 3], // deliberately below the KHDA minimum to show the compliance warning
    ["ISL", "Year 4", 2, 2],
    ["UAESS", "Year 4", 3, 2],
    ["MSC", "Year 4", 3, 1],
  ];
  for (const [code, g, tIdx, periods] of assignmentPlan) {
    const section = sections.find((s) => s.grade.name === g && s.name === "A")!;
    const a = await prisma.teachingAssignment.create({
      data: { sectionId: section.id, subjectId: subj(code).id, teacherId: staff[tIdx].id, weeklyPeriods: periods },
    });
    // spread periods across the week (Mon–Fri, 6 periods a day)
    for (let p = 0; p < Math.min(periods, 5); p++) {
      await prisma.timetableSlot.create({ data: { assignmentId: a.id, dayOfWeek: (p % 5) + 1, period: (assignmentPlan.findIndex((x) => x[0] === code && x[1] === g) % 6) + 1 } });
    }
  }

  // Guardians + students
  const studentSpecs = [
    ["Ahmed", "Al Maktoum", "MALE", "2022-03-14", "United Arab Emirates", true, true, true, "FS2", "A"],
    ["Layla", "Hassan", "FEMALE", "2021-06-02", "Egypt", false, true, true, "Year 1", "A"],
    ["Rohan", "Mehta", "MALE", "2021-01-20", "India", false, false, false, "Year 1", "A"],
    ["Emily", "Carter", "FEMALE", "2021-09-30", "United Kingdom", false, false, false, "Year 1", "A"],
    ["Yusuf", "Rahman", "MALE", "2021-04-11", "Bangladesh", false, true, false, "Year 1", "B"],
    ["Noor", "Al Suwaidi", "FEMALE", "2018-05-05", "United Arab Emirates", true, true, true, "Year 4", "A"],
    ["Daniel", "Okafor", "MALE", "2018-02-17", "Nigeria", false, false, false, "Year 4", "A"],
    ["Sara", "Haddad", "FEMALE", "2018-07-22", "Lebanon", false, true, true, "Year 4", "A"],
    ["Arjun", "Pillai", "MALE", "2015-08-01", "India", false, false, false, "Year 7", "A"],
    ["Hana", "Yamamoto", "FEMALE", "2015-11-09", "Japan", false, false, false, "Year 7", "A"],
    ["Khalid", "Al Falasi", "MALE", "2012-03-03", "United Arab Emirates", true, true, true, "Year 10", "A"],
    ["Maya", "Schneider", "FEMALE", "2012-12-25", "Germany", false, false, false, "Year 10", "A"],
  ] as const;

  const parentUser = await prisma.user.create({ data: { email: "parent@school.test", passwordHash, name: "Mohammed Al Maktoum", role: "PARENT" } });

  const students = [];
  let n = 1;
  for (const [first, last, gender, dob, nat, emirati, muslim, arabic, g, sec] of studentSpecs) {
    const section = sections.find((s) => s.grade.name === g && s.name === sec)!;
    const guardian = await prisma.guardian.create({
      data: {
        userId: n === 1 ? parentUser.id : null,
        firstName: n === 1 ? "Mohammed" : `Parent of ${first}`,
        lastName: last,
        relationship: n % 2 ? "Father" : "Mother",
        nationality: nat,
        emiratesId: fakeEmiratesId(200 + n),
        phone: `+971 55 100 0${String(n).padStart(3, "0")}`,
        email: n === 1 ? "parent@school.test" : `parent${n}@example.test`,
        address: "Dubai, UAE",
      },
    });
    const student = await prisma.student.create({
      data: {
        studentNo: `STU-2026-${String(n).padStart(4, "0")}`,
        firstName: first,
        lastName: last,
        gender,
        dateOfBirth: d(dob),
        nationality: nat,
        isEmirati: emirati,
        emiratesId: fakeEmiratesId(300 + n),
        emiratesIdExpiry: d(n === 4 ? "2026-10-01" : "2029-01-01"),
        passportNo: `SP${2000000 + n}`,
        passportExpiry: d("2030-06-30"),
        visaNo: emirati ? null : `V${300000 + n}`,
        visaExpiry: emirati ? null : d(n === 7 ? "2026-09-30" : "2028-01-01"),
        isMuslim: muslim,
        arabicFirstLanguage: arabic,
        isStudentOfDetermination: n === 7,
        sendCategory: n === 7 ? "Specific learning difficulty (dyslexia)" : null,
        isGifted: n === 10,
        isEAL: !["United Kingdom", "Nigeria", "India"].includes(nat) && !arabic,
        previousSchool: n > 2 ? "Previous School Example" : null,
        previousSchoolCountry: n > 2 ? nat : null,
        admissionDate: d("2026-08-31"),
        status: "ENROLLED",
        gradeId: section.gradeId,
        sectionId: section.id,
        emergencyContactName: `${guardian.firstName} ${guardian.lastName}`,
        emergencyContactPhone: guardian.phone,
        usesSchoolTransport: n % 3 === 0,
        guardians: { create: { guardianId: guardian.id, isPrimary: true } },
        documents: {
          create: [
            { type: "EMIRATES_ID", status: "VERIFIED", expiryDate: d(n === 4 ? "2026-10-01" : "2029-01-01") },
            { type: "PASSPORT", status: "VERIFIED", expiryDate: d("2030-06-30") },
            { type: "VISA", status: visaStatus(emirati, n), expiryDate: emirati ? null : d(n === 7 ? "2026-09-30" : "2028-01-01") },
            { type: "BIRTH_CERTIFICATE", status: "VERIFIED" },
            { type: "TRANSFER_CERTIFICATE", status: transferCertStatus(n) },
            { type: "IMMUNISATION_RECORD", status: n === 5 ? "MISSING" : "VERIFIED" },
            { type: "PHOTO", status: "RECEIVED" },
          ],
        },
      },
    });
    students.push(student);
    n++;
  }

  // Applicant (not yet enrolled)
  await prisma.student.create({
    data: {
      studentNo: "STU-2026-0013",
      firstName: "Zain",
      lastName: "Qureshi",
      gender: "MALE",
      dateOfBirth: d("2022-10-20"),
      nationality: "Pakistan",
      isMuslim: true,
      admissionDate: d("2026-09-20"),
      status: "APPLICANT",
      gradeId: gradeByName["FS2"].id,
      documents: { create: [{ type: "PASSPORT", status: "RECEIVED" }, { type: "BIRTH_CERTIFICATE", status: "RECEIVED" }] },
    },
  });

  // Attendance: last 10 school days
  const today = new Date();
  const days: Date[] = [];
  for (let back = 0; days.length < 10; back++) {
    const dt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back));
    const dow = dt.getUTCDay();
    if (dow >= 1 && dow <= 5) days.push(dt);
  }
  for (const s of students) {
    for (const [idx, day] of days.entries()) {
      let status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "MEDICAL" = "PRESENT";
      const r = (s.studentNo.charCodeAt(s.studentNo.length - 1) + idx) % 17;
      if (r === 0) status = "ABSENT";
      else if (r === 5) status = "LATE";
      else if (r === 9) status = "MEDICAL";
      await prisma.attendance.create({ data: { studentId: s.id, date: day, status, recordedBy: "seed" } });
    }
  }

  // Assessments for Year 4 A (Term 1)
  const y4 = sections.find((s) => s.grade.name === "Year 4")!;
  const term1 = year.terms.find((t) => t.number === 1)!;
  for (const code of ["ENG", "MAT", "ARA-B"]) {
    const a = await prisma.assessment.create({
      data: { name: `Term 1 baseline – ${subj(code).name}`, type: "FORMATIVE", sectionId: y4.id, subjectId: subj(code).id, termId: term1.id, maxMarks: 100, date: d("2026-09-10") },
    });
    for (const s of students.filter((st) => st.sectionId === y4.id)) {
      const marks = 55 + ((s.studentNo.charCodeAt(s.studentNo.length - 1) * 7 + code.length * 11) % 40);
      await prisma.assessmentResult.create({ data: { assessmentId: a.id, studentId: s.id, marks, gradeLabel: gradeFor(marks) } });
    }
  }
  await prisma.assessment.create({
    data: { name: "GL Progress Test in English (external benchmark)", type: "EXTERNAL_BENCHMARK", sectionId: y4.id, subjectId: subj("ENG").id, termId: term1.id, maxMarks: 140, date: d("2026-10-05") },
  });

  // Fee structures (AED, KHDA-approved)
  const tuition: Record<string, number> = { FS1: 32000, FS2: 34000, "Year 1": 38000, "Year 4": 44000, "Year 7": 52000, "Year 10": 60000 };
  for (const g of grades) {
    const base = tuition[g.name] ?? 30000 + g.order * 2000;
    await prisma.feeStructure.create({
      data: {
        academicYearId: year.id,
        gradeId: g.id,
        annualTuition: base,
        khdaApprovalRef: "FF-2026-0001",
        registrationDeposit: Math.round(base * 0.1),
        transportFee: 7500,
        booksFee: 1500,
        uniformFee: 900,
      },
    });
  }

  // Term 1 invoices
  let inv = 1;
  for (const s of students) {
    const fs = await prisma.feeStructure.findUniqueOrThrow({ where: { academicYearId_gradeId: { academicYearId: year.id, gradeId: s.gradeId } } });
    const annual = Number(fs.annualTuition);
    const termTuition = Math.round((annual * term1.feeSharePct) / 100);
    const deposit = Number(fs.registrationDeposit);
    const items: { type: "TUITION" | "REGISTRATION_DEPOSIT" | "TRANSPORT"; description: string; amount: number }[] = [
      { type: "TUITION", description: "Term 1 tuition (40% of annual KHDA-approved fee)", amount: termTuition },
      { type: "REGISTRATION_DEPOSIT", description: "Less: registration deposit already paid", amount: -deposit },
    ];
    if (s.usesSchoolTransport) items.push({ type: "TRANSPORT", description: "Term 1 school transport", amount: 2500 });
    const total = items.reduce((a, b) => a + b.amount, 0);
    const paid = demoPaidAmount(inv, total);
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: `INV-2026-${String(inv).padStart(5, "0")}`,
        studentId: s.id,
        termId: term1.id,
        issueDate: d("2026-08-20"),
        dueDate: d("2026-09-15"),
        status: invoiceStatus(paid, total),
        items: { create: items },
      },
    });
    if (paid > 0) await prisma.payment.create({ data: { invoiceId: invoice.id, amount: paid, method: inv % 2 ? "BANK_TRANSFER" : "CARD", reference: `TXN${9000 + inv}`, paidAt: d("2026-09-01"), receivedBy: "Omar Accountant" } });
    inv++;
  }

  // IEP for the student of determination, an incident, a self-evaluation, a contract
  const sod = students[6];
  await prisma.iep.create({
    data: {
      studentId: sod.id,
      status: "ACTIVE",
      needs: "Specific learning difficulty (dyslexia). Reading fluency below age-related expectations.",
      targets: "Increase reading age by 12 months by June 2027; independently use coloured overlays and reading ruler.",
      provisions: "Small-group phonics intervention 3×/week; extra time (25%) in assessments; access to text-to-speech.",
      reviewDate: d("2026-12-01"),
      coordinator: "Priya Nair (Inclusion Champion)",
    },
  });
  await prisma.incident.create({
    data: { studentId: students[8].id, type: "BEHAVIOUR", severity: "LOW", occurredAt: d("2026-09-08"), description: "Disruption during Mathematics lesson.", actionTaken: "Restorative conversation; parents informed.", reportedBy: "Aisha Khan", resolved: true },
  });
  for (const std of DSIB_STANDARDS) {
    for (const ind of std.indicators) {
      await prisma.selfEvaluation.create({
        data: { academicYearId: year.id, standard: std.number, indicator: ind, rating: std.number === 5 ? "VERY_GOOD" : "GOOD", evidence: "Evidence to be uploaded ahead of the DSIB inspection window." },
      });
    }
  }
  await prisma.parentSchoolContract.create({
    data: { studentId: students[0].id, academicYearId: year.id, status: "SIGNED", tuitionFee: 34000, content: "Parent–School Contract (seeded sample). See Compliance › Contracts to regenerate.", signedAt: d("2026-08-15") },
  });

  await prisma.auditLog.create({ data: { userId: admin.id, action: "SEED", entity: "System", details: "Demo data seeded" } });

  console.info("Seeded demo data. Demo accounts (see README for how to sign in):");
  console.info("  admin@school.test, registrar@school.test, accounts@school.test, aisha.khan@school.test (teacher), parent@school.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
