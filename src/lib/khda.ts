/**
 * KHDA (Knowledge and Human Development Authority, Dubai) business rules.
 *
 * The numbers below reflect KHDA's published frameworks as generally applied by Dubai
 * private schools (age placement chart, fee framework, Parent–School Contract, DSIB
 * inspection framework). KHDA revises these through circulars, so every constant here
 * is deliberately isolated so it can be verified against the current circular and
 * updated in one place.
 */
import type { AcademicYearStart, Curriculum, DsibRating, Phase, SubjectApplicability } from "@/generated/prisma/client";

// ───────────────────────── Age placement ─────────────────────────

export type GradeSpec = { name: string; order: number; phase: Phase; minAgeYears: number };

const uk: GradeSpec[] = [
  { name: "FS1", order: 1, phase: "EARLY_YEARS", minAgeYears: 3 },
  { name: "FS2", order: 2, phase: "EARLY_YEARS", minAgeYears: 4 },
  ...Array.from({ length: 6 }, (_, i) => ({ name: `Year ${i + 1}`, order: i + 3, phase: "PRIMARY" as Phase, minAgeYears: i + 5 })),
  ...Array.from({ length: 5 }, (_, i) => ({ name: `Year ${i + 7}`, order: i + 9, phase: "SECONDARY" as Phase, minAgeYears: i + 11 })),
  { name: "Year 12", order: 14, phase: "POST_16", minAgeYears: 16 },
  { name: "Year 13", order: 15, phase: "POST_16", minAgeYears: 17 },
];

const usStyle = (preKName: string, kg1: string, kg2: string): GradeSpec[] => [
  { name: preKName, order: 1, phase: "EARLY_YEARS", minAgeYears: 3 },
  { name: kg1, order: 2, phase: "EARLY_YEARS", minAgeYears: 4 },
  { name: kg2, order: 3, phase: "EARLY_YEARS", minAgeYears: 5 },
  ...Array.from({ length: 5 }, (_, i) => ({ name: `Grade ${i + 1}`, order: i + 4, phase: "PRIMARY" as Phase, minAgeYears: i + 6 })),
  ...Array.from({ length: 5 }, (_, i) => ({ name: `Grade ${i + 6}`, order: i + 9, phase: "SECONDARY" as Phase, minAgeYears: i + 11 })),
  { name: "Grade 11", order: 14, phase: "POST_16", minAgeYears: 16 },
  { name: "Grade 12", order: 15, phase: "POST_16", minAgeYears: 17 },
];

export const GRADE_CATALOGUE: Record<Curriculum, GradeSpec[]> = {
  UK: uk,
  US: usStyle("Pre-KG", "KG1", "KG2"),
  IB: usStyle("Pre-KG", "KG1", "KG2"),
  INDIAN_CBSE: usStyle("Pre-KG", "KG1 (LKG)", "KG2 (UKG)"),
  INDIAN_ICSE: usStyle("Pre-KG", "KG1 (LKG)", "KG2 (UKG)"),
  MOE: usStyle("Pre-KG", "KG1", "KG2"),
  FRENCH: usStyle("Petite Section", "Moyenne Section", "Grande Section"),
  OTHER: usStyle("Pre-KG", "KG1", "KG2"),
};

/** Academic years starting in April (Indian curricula) use a 31 March cut-off; September schools use 31 August. */
export function ageCutoffDate(start: AcademicYearStart, academicYearStartDate: Date): Date {
  const y = academicYearStartDate.getUTCFullYear();
  return start === "APRIL" ? new Date(Date.UTC(y, 2, 31)) : new Date(Date.UTC(y, 7, 31));
}

export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Students older than the minimum by more than this many years need KHDA approval for placement. */
export const MAX_AGE_VARIANCE_YEARS = 2;

export type AgeCheck = {
  ageOnCutoff: number;
  cutoff: Date;
  ok: boolean;
  tooYoung: boolean;
  needsKhdaApproval: boolean;
  message: string;
};

export function checkAgePlacement(dob: Date, minAgeYears: number, cutoff: Date): AgeCheck {
  const age = ageOn(dob, cutoff);
  const tooYoung = age < minAgeYears;
  const needsKhdaApproval = age > minAgeYears + MAX_AGE_VARIANCE_YEARS;
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  let message = `Student will be ${age} on the KHDA cut-off date (${cutoffStr}); grade minimum is ${minAgeYears}.`;
  if (tooYoung) message = `Too young: student will be ${age} on ${cutoffStr}, but the grade requires ${minAgeYears}+.`;
  else if (needsKhdaApproval) message = `Age ${age} exceeds the grade minimum (${minAgeYears}) by more than ${MAX_AGE_VARIANCE_YEARS} years – KHDA approval is required for this placement.`;
  return { ageOnCutoff: age, cutoff, ok: !tooYoung, tooYoung, needsKhdaApproval, message };
}

// ───────────────────────── Mandatory subjects ─────────────────────────

export type MandatorySubject = {
  code: string;
  name: string;
  nameAr: string;
  applicability: SubjectApplicability;
  /** Minimum weekly periods by phase (schools configure per grade; verify with the current KHDA circular). */
  minWeeklyPeriods: Partial<Record<Phase, number>>;
};

export const MANDATORY_SUBJECTS: MandatorySubject[] = [
  { code: "ARA-A", name: "Arabic (first language)", nameAr: "اللغة العربية (لغة أولى)", applicability: "ARABIC_NATIVE", minWeeklyPeriods: { PRIMARY: 6, SECONDARY: 4, POST_16: 4 } },
  { code: "ARA-B", name: "Arabic (additional language)", nameAr: "اللغة العربية (لغة إضافية)", applicability: "ARABIC_NON_NATIVE", minWeeklyPeriods: { PRIMARY: 4, SECONDARY: 4 } },
  { code: "ISL", name: "Islamic Education", nameAr: "التربية الإسلامية", applicability: "MUSLIM_ONLY", minWeeklyPeriods: { PRIMARY: 2, SECONDARY: 2, POST_16: 2 } },
  { code: "UAESS", name: "UAE Social Studies", nameAr: "الدراسات الاجتماعية", applicability: "ALL", minWeeklyPeriods: { PRIMARY: 2, SECONDARY: 2 } },
  { code: "MSC", name: "Moral, Social and Cultural Studies", nameAr: "التربية الأخلاقية والاجتماعية والثقافية", applicability: "ALL", minWeeklyPeriods: { PRIMARY: 1, SECONDARY: 1, POST_16: 1 } },
];

export function subjectAppliesToStudent(
  applicability: SubjectApplicability,
  student: { isMuslim: boolean; arabicFirstLanguage: boolean },
) {
  switch (applicability) {
    case "ALL":
      return true;
    case "MUSLIM_ONLY":
      return student.isMuslim;
    case "ARABIC_NATIVE":
      return student.arabicFirstLanguage;
    case "ARABIC_NON_NATIVE":
      return !student.arabicFirstLanguage;
  }
}

// ───────────────────────── Fees ─────────────────────────

/** Registration / re-registration deposit may not exceed 10% of annual tuition and is deducted from term-1 fees. */
export const MAX_REGISTRATION_DEPOSIT_RATIO = 0.1;

/** Default split of annual tuition across three terms (KHDA: no more than three instalments unless parents agree to more). */
export const DEFAULT_TERM_FEE_SPLIT = [40, 30, 30];

/** KHDA fee-increase multiplier of the Educational Cost Index (ECI) by last inspection rating. */
export const FEE_INCREASE_MULTIPLIER: Record<DsibRating, number> = {
  OUTSTANDING: 2.0,
  VERY_GOOD: 1.75,
  GOOD: 1.5,
  ACCEPTABLE: 1.0,
  WEAK: 1.0,
  VERY_WEAK: 1.0,
};

export function maxFeeIncreasePct(rating: DsibRating | null | undefined, eciPct: number) {
  if (!rating) return eciPct;
  return +(FEE_INCREASE_MULTIPLIER[rating] * eciPct).toFixed(2);
}

export function validateRegistrationDeposit(annualTuition: number, deposit: number) {
  const max = annualTuition * MAX_REGISTRATION_DEPOSIT_RATIO;
  return { ok: deposit <= max + 0.005, max };
}

/**
 * KHDA refund rule for withdrawals during a term. "One month's fee" is 1/10 of the annual tuition
 * (ten-month academic year). Attendance is counted in school days from the start of the term.
 *  - attended ≤ 2 weeks  → school retains one month's fee
 *  - 2 weeks < attended ≤ 1 month → school retains two months' fee
 *  - attended > 1 month → school retains the full term fee
 */
export function computeTermRefund(params: { annualTuition: number; termFee: number; termStart: Date; withdrawalDate: Date }) {
  const { annualTuition, termFee, termStart, withdrawalDate } = params;
  const monthly = annualTuition / 10;
  const daysAttended = Math.max(0, Math.round((withdrawalDate.getTime() - termStart.getTime()) / 86_400_000));
  let retained: number;
  let rule: string;
  if (daysAttended <= 14) {
    retained = Math.min(monthly, termFee);
    rule = "Attended two weeks or less: one month's fee retained";
  } else if (daysAttended <= 30) {
    retained = Math.min(2 * monthly, termFee);
    rule = "Attended more than two weeks and up to one month: two months' fee retained";
  } else {
    retained = termFee;
    rule = "Attended more than one month: full term fee retained";
  }
  return { daysAttended, monthlyFee: monthly, retained: +retained.toFixed(2), refund: +(termFee - retained).toFixed(2), rule };
}

// ───────────────────────── Attendance & inspection ─────────────────────────

/** Attendance bands used by DSIB when judging attendance (indicative). */
export function attendanceBand(pct: number): DsibRating {
  if (pct >= 98) return "OUTSTANDING";
  if (pct >= 96) return "VERY_GOOD";
  if (pct >= 94) return "GOOD";
  if (pct >= 92) return "ACCEPTABLE";
  if (pct >= 90) return "WEAK";
  return "VERY_WEAK";
}

export const DSIB_STANDARDS: { number: number; title: string; indicators: string[] }[] = [
  { number: 1, title: "Students' achievement", indicators: ["Attainment", "Progress", "Learning skills"] },
  { number: 2, title: "Students' personal and social development, and their innovation skills", indicators: ["Personal development", "Understanding of Islamic values and awareness of Emirati and world cultures", "Social responsibility and innovation skills"] },
  { number: 3, title: "Teaching and assessment", indicators: ["Teaching for effective learning", "Assessment"] },
  { number: 4, title: "Curriculum", indicators: ["Curriculum design and implementation", "Curriculum adaptation"] },
  { number: 5, title: "The protection, care, guidance and support of students", indicators: ["Health and safety, including arrangements for child protection / safeguarding", "Care and support"] },
  { number: 6, title: "Leadership and management", indicators: ["The effectiveness of leadership", "School self-evaluation and improvement planning", "Parents and the community", "Governance", "Management, staffing, facilities and resources"] },
];

export const DSIB_RATING_LABEL: Record<DsibRating, string> = {
  OUTSTANDING: "Outstanding",
  VERY_GOOD: "Very good",
  GOOD: "Good",
  ACCEPTABLE: "Acceptable",
  WEAK: "Weak",
  VERY_WEAK: "Very weak",
};

// ───────────────────────── Identifiers ─────────────────────────

/** Emirates ID: 15 digits, starts with 784, usually written 784-YYYY-NNNNNNN-C. */
export function normaliseEmiratesId(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function isValidEmiratesId(value: string) {
  const v = normaliseEmiratesId(value);
  if (!/^784\d{12}$/.test(v)) return false;
  // Luhn check digit
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(v[i]);
    if ((15 - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function formatEmiratesId(value: string) {
  const v = normaliseEmiratesId(value);
  if (v.length !== 15) return value;
  return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7, 14)}-${v.slice(14)}`;
}

/** Documents every enrolled student must have on file for KHDA registration. */
export const REQUIRED_STUDENT_DOCUMENTS = [
  "EMIRATES_ID",
  "PASSPORT",
  "VISA",
  "BIRTH_CERTIFICATE",
  "TRANSFER_CERTIFICATE",
  "IMMUNISATION_RECORD",
  "PHOTO",
] as const;
