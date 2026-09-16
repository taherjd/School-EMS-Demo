"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ageCutoffDate, checkAgePlacement, isValidEmiratesId, normaliseEmiratesId, REQUIRED_STUDENT_DOCUMENTS, computeTermRefund } from "@/lib/khda";
import { bool, date, opt, str, zodError, handleActionError } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { Prisma } from "@/generated/prisma/client";

const studentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nameAr: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.date({ error: "Date of birth is required" }),
  nationality: z.string().min(1),
  emiratesId: z.string().nullable(),
  emiratesIdExpiry: z.date().nullable(),
  passportNo: z.string().nullable(),
  passportExpiry: z.date().nullable(),
  visaNo: z.string().nullable(),
  visaExpiry: z.date().nullable(),
  isMuslim: z.boolean(),
  arabicFirstLanguage: z.boolean(),
  isStudentOfDetermination: z.boolean(),
  sendCategory: z.string().nullable(),
  isGifted: z.boolean(),
  isEAL: z.boolean(),
  previousSchool: z.string().nullable(),
  previousSchoolCountry: z.string().nullable(),
  admissionDate: z.date({ error: "Admission date is required" }),
  gradeId: z.string().min(1, "Grade is required"),
  sectionId: z.string().nullable(),
  bloodGroup: z.string().nullable(),
  medicalNotes: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  usesSchoolTransport: z.boolean(),
  overrideAge: z.boolean(),
});

function parseStudent(fd: FormData) {
  return studentSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    nameAr: opt(fd, "nameAr"),
    gender: str(fd, "gender"),
    dateOfBirth: date(fd, "dateOfBirth"),
    nationality: str(fd, "nationality"),
    emiratesId: opt(fd, "emiratesId"),
    emiratesIdExpiry: date(fd, "emiratesIdExpiry"),
    passportNo: opt(fd, "passportNo"),
    passportExpiry: date(fd, "passportExpiry"),
    visaNo: opt(fd, "visaNo"),
    visaExpiry: date(fd, "visaExpiry"),
    isMuslim: bool(fd, "isMuslim"),
    arabicFirstLanguage: bool(fd, "arabicFirstLanguage"),
    isStudentOfDetermination: bool(fd, "isStudentOfDetermination"),
    sendCategory: opt(fd, "sendCategory"),
    isGifted: bool(fd, "isGifted"),
    isEAL: bool(fd, "isEAL"),
    previousSchool: opt(fd, "previousSchool"),
    previousSchoolCountry: opt(fd, "previousSchoolCountry"),
    admissionDate: date(fd, "admissionDate"),
    gradeId: str(fd, "gradeId"),
    sectionId: opt(fd, "sectionId"),
    bloodGroup: opt(fd, "bloodGroup"),
    medicalNotes: opt(fd, "medicalNotes"),
    emergencyContactName: opt(fd, "emergencyContactName"),
    emergencyContactPhone: opt(fd, "emergencyContactPhone"),
    usesSchoolTransport: bool(fd, "usesSchoolTransport"),
    overrideAge: bool(fd, "overrideAge"),
  });
}

async function validateKhda(data: z.infer<typeof studentSchema>): Promise<string | null> {
  if (data.emiratesId && !isValidEmiratesId(data.emiratesId)) return "Emirates ID is not valid (expected 15 digits starting with 784, e.g. 784-YYYY-NNNNNNN-C).";
  const [school, year, grade] = await Promise.all([
    prisma.school.findFirst(),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.grade.findUnique({ where: { id: data.gradeId } }),
  ]);
  if (!grade) return "Grade not found.";
  if (school && year) {
    const cutoff = ageCutoffDate(school.academicYearStart, year.startDate);
    const check = checkAgePlacement(data.dateOfBirth, grade.minAgeYears, cutoff);
    if (check.tooYoung) return `KHDA age placement: ${check.message}`;
    if (check.needsKhdaApproval && !data.overrideAge) return `${check.message} Tick "KHDA approval obtained" to proceed.`;
  }
  return null;
}

async function nextStudentNo() {
  const year = new Date().getFullYear();
  const count = await prisma.student.count();
  return `STU-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const parsed = parseStudent(fd);
    if (!parsed.success) return zodError(parsed.error);
    const data = parsed.data;
    const err = await validateKhda(data);
    if (err) return { error: err };

    const guardian = {
      firstName: str(fd, "gFirstName"),
      lastName: str(fd, "gLastName"),
      relationship: str(fd, "gRelationship") || "Parent",
      phone: str(fd, "gPhone"),
      email: opt(fd, "gEmail"),
      emiratesId: opt(fd, "gEmiratesId"),
      nationality: opt(fd, "gNationality"),
    };
    if (!guardian.firstName || !guardian.phone) return { error: "Primary guardian name and phone are required." };
    if (guardian.emiratesId && !isValidEmiratesId(guardian.emiratesId)) return { error: "Guardian Emirates ID is not valid." };
    const createPortal = bool(fd, "gCreatePortal");
    const portalPassword = str(fd, "gPortalPassword");
    if (createPortal && !guardian.email) return { error: "Guardian email is required to create a parent portal account." };
    if (createPortal && portalPassword.length < 8) return { error: "Set an initial portal password of at least 8 characters (share it with the parent securely)." };

    const { overrideAge, ...studentData } = data;
    const studentNo = await nextStudentNo();
    const isEmirati = /united arab emirates|^uae$|emirati/i.test(data.nationality);

    let portalUserId: string | null = null;
    if (createPortal && guardian.email) {
      const existing = await prisma.user.findUnique({ where: { email: guardian.email.toLowerCase() } });
      if (existing) portalUserId = existing.id;
      else {
        const passwordHash = await hashPassword(portalPassword);
        const u = await prisma.user.create({ data: { email: guardian.email.toLowerCase(), passwordHash, name: `${guardian.firstName} ${guardian.lastName}`, role: "PARENT" } });
        portalUserId = u.id;
        await audit(session.userId, "CREATE_PORTAL_USER", "User", u.id);
      }
    }

    const student = await prisma.student.create({
      data: {
        ...studentData,
        emiratesId: data.emiratesId ? normaliseEmiratesId(data.emiratesId) : null,
        studentNo,
        isEmirati,
        status: "APPLICANT",
        guardians: {
          create: {
            isPrimary: true,
            guardian: { create: { ...guardian, emiratesId: guardian.emiratesId ? normaliseEmiratesId(guardian.emiratesId) : null, userId: portalUserId } },
          },
        },
        documents: {
          create: REQUIRED_STUDENT_DOCUMENTS.filter((t) => !(t === "VISA" && isEmirati)).map((type) => ({ type, status: "MISSING" as const })),
        },
      },
    });
    await audit(session.userId, "CREATE", "Student", student.id, { studentNo, overrideAge });
    revalidatePath("/students");
    redirect(`/students/${student.id}`);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateStudent(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const parsed = parseStudent(fd);
    if (!parsed.success) return zodError(parsed.error);
    const err = await validateKhda(parsed.data);
    if (err) return { error: err };
    const { overrideAge, ...data } = parsed.data;
    await prisma.student.update({
      where: { id },
      data: { ...data, emiratesId: data.emiratesId ? normaliseEmiratesId(data.emiratesId) : null, isEmirati: /united arab emirates|^uae$|emirati/i.test(data.nationality) },
    });
    await audit(session.userId, "UPDATE", "Student", id, { overrideAge });
    revalidatePath(`/students/${id}`);
    redirect(`/students/${id}`);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function enrolStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const id = str(fd, "studentId");
    const sectionId = opt(fd, "sectionId");
    const student = await prisma.student.findUnique({ where: { id }, include: { documents: true } });
    if (!student) return { error: "Student not found" };
    if (!sectionId) return { error: "Choose a section to enrol the student into." };
    const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { _count: { select: { students: { where: { status: "ENROLLED" } } } } } });
    if (!section || section.gradeId !== student.gradeId) return { error: "Section must belong to the student's grade." };
    if (section._count.students >= section.capacity) return { error: `Section is full (capacity ${section.capacity}).` };
    const missing = student.documents.filter((d) => d.status === "MISSING" && ["EMIRATES_ID", "PASSPORT", "BIRTH_CERTIFICATE"].includes(d.type));
    if (missing.length && !bool(fd, "force")) {
      return { error: `Missing core registration documents: ${missing.map((m) => m.type.replace(/_/g, " ").toLowerCase()).join(", ")}. Tick "Enrol anyway" to proceed and follow up.` };
    }
    await prisma.student.update({ where: { id }, data: { status: "ENROLLED", sectionId, withdrawalDate: null, withdrawalReason: null } });
    await audit(session.userId, "ENROL", "Student", id, { sectionId, forced: bool(fd, "force") });
    revalidatePath(`/students/${id}`);
    revalidatePath("/students");
    return { success: "Student enrolled." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function withdrawStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const id = str(fd, "studentId");
    const when = date(fd, "withdrawalDate");
    const reason = str(fd, "withdrawalReason");
    const status = str(fd, "newStatus") === "TRANSFERRED" ? "TRANSFERRED" : "WITHDRAWN";
    if (!when) return { error: "Withdrawal date is required." };
    if (!reason) return { error: "Reason is required (KHDA transfer certificate records)." };
    const student = await prisma.student.findUnique({ where: { id }, include: { grade: true } });
    if (!student) return { error: "Student not found" };
    // Compute the KHDA refund position for the current term for the audit record
    const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: true } });
    let refundNote: unknown = null;
    if (year) {
      const term = year.terms.find((t) => when >= t.startDate && when <= t.endDate);
      const fs = await prisma.feeStructure.findUnique({ where: { academicYearId_gradeId: { academicYearId: year.id, gradeId: student.gradeId } } });
      if (term && fs) {
        const annual = Number(fs.annualTuition);
        refundNote = computeTermRefund({ annualTuition: annual, termFee: (annual * term.feeSharePct) / 100, termStart: term.startDate, withdrawalDate: when });
      }
    }
    await prisma.student.update({ where: { id }, data: { status, withdrawalDate: when, withdrawalReason: reason, sectionId: null } });
    await audit(session.userId, status, "Student", id, { reason, refund: refundNote });
    revalidatePath(`/students/${id}`);
    revalidatePath("/students");
    return { success: `Student marked as ${status.toLowerCase()}. Issue the KHDA transfer certificate and settle fees per the refund policy (see Fees › Refund calculator).` };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const studentId = str(fd, "studentId");
    const type = str(fd, "type") as Prisma.StudentDocumentUncheckedCreateInput["type"];
    const status = str(fd, "status") as Prisma.StudentDocumentUncheckedCreateInput["status"];
    const expiryDate = date(fd, "expiryDate");
    const reference = opt(fd, "reference");
    await prisma.studentDocument.upsert({
      where: { studentId_type: { studentId, type } },
      update: { status, expiryDate, reference },
      create: { studentId, type, status, expiryDate, reference },
    });
    await audit(session.userId, "UPDATE_DOCUMENT", "Student", studentId, { type, status });
    revalidatePath(`/students/${studentId}`);
    return { success: "Document updated." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function addGuardian(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const studentId = str(fd, "studentId");
    const firstName = str(fd, "firstName");
    const lastName = str(fd, "lastName");
    const phone = str(fd, "phone");
    if (!firstName || !phone) return { error: "Guardian name and phone are required." };
    const emiratesId = opt(fd, "emiratesId");
    if (emiratesId && !isValidEmiratesId(emiratesId)) return { error: "Guardian Emirates ID is not valid." };
    await prisma.guardian.create({
      data: {
        firstName, lastName, phone,
        relationship: str(fd, "relationship") || "Guardian",
        email: opt(fd, "email"),
        emiratesId: emiratesId ? normaliseEmiratesId(emiratesId) : null,
        nationality: opt(fd, "nationality"),
        students: { create: { studentId, isPrimary: bool(fd, "isPrimary") } },
      },
    });
    await audit(session.userId, "ADD_GUARDIAN", "Student", studentId);
    revalidatePath(`/students/${studentId}`);
    return { success: "Guardian added." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function saveIep(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
    const studentId = str(fd, "studentId");
    const iepId = opt(fd, "iepId");
    const reviewDate = date(fd, "reviewDate");
    const needs = str(fd, "needs"), targets = str(fd, "targets"), provisions = str(fd, "provisions");
    if (!needs || !targets || !provisions || !reviewDate) return { error: "Needs, targets, provisions and review date are required." };
    const status = str(fd, "status") as "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "CLOSED";
    const data = { needs, targets, provisions, reviewDate, status, coordinator: opt(fd, "coordinator") };
    if (iepId) await prisma.iep.update({ where: { id: iepId }, data });
    else await prisma.iep.create({ data: { ...data, studentId } });
    await prisma.student.update({ where: { id: studentId }, data: { isStudentOfDetermination: true } });
    await audit(session.userId, iepId ? "UPDATE_IEP" : "CREATE_IEP", "Student", studentId);
    revalidatePath(`/students/${studentId}`);
    return { success: "IEP saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function logIncident(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
    const studentId = str(fd, "studentId");
    const occurredAt = date(fd, "occurredAt");
    const description = str(fd, "description");
    if (!occurredAt || !description) return { error: "Date and description are required." };
    await prisma.incident.create({
      data: {
        studentId,
        occurredAt,
        description,
        type: str(fd, "type") as "SAFEGUARDING" | "BEHAVIOUR" | "BULLYING" | "MEDICAL" | "WELLBEING" | "OTHER",
        severity: str(fd, "severity") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        actionTaken: opt(fd, "actionTaken"),
        reportedBy: session.name,
        resolved: bool(fd, "resolved"),
      },
    });
    await audit(session.userId, "LOG_INCIDENT", "Student", studentId, { type: str(fd, "type") });
    revalidatePath(`/students/${studentId}`);
    return { success: "Incident logged." };
  } catch (e) {
    return handleActionError(e);
  }
}
