"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { num } from "@/lib/format";
import { renderContract } from "@/lib/contract";
import { opt, str, handleActionError } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { DsibRating } from "@/generated/prisma/client";

export async function saveSelfEvaluation(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN");
    const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!year) return { error: "No current academic year." };
    const standard = Number(str(fd, "standard")), indicator = str(fd, "indicator");
    const rating = str(fd, "rating") as DsibRating;
    await prisma.selfEvaluation.upsert({
      where: { academicYearId_standard_indicator: { academicYearId: year.id, standard, indicator } },
      update: { rating, evidence: opt(fd, "evidence"), actions: opt(fd, "actions") },
      create: { academicYearId: year.id, standard, indicator, rating, evidence: opt(fd, "evidence"), actions: opt(fd, "actions") },
    });
    await audit(session.userId, "SAVE_SEF", "SelfEvaluation", `${standard}:${indicator}`, { rating });
    revalidatePath("/compliance/sef");
    return { success: "Saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function generateContract(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const studentId = str(fd, "studentId");
    const [student, school, year] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, include: { grade: true, guardians: { include: { guardian: true } } } }),
      prisma.school.findFirst(),
      prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { number: "asc" } } } }),
    ]);
    if (!student || !school || !year) return { error: "Student, school profile and current academic year are required." };
    const fs = await prisma.feeStructure.findUnique({ where: { academicYearId_gradeId: { academicYearId: year.id, gradeId: student.gradeId } } });
    if (!fs) return { error: `No fee structure for ${student.grade.name} in ${year.name}.` };
    const primary = student.guardians.find((g) => g.isPrimary)?.guardian ?? student.guardians[0]?.guardian;
    const content = renderContract({
      schoolName: school.name, khdaSchoolId: school.khdaSchoolId, yearName: year.name,
      studentName: `${student.firstName} ${student.lastName}`, studentNo: student.studentNo, grade: student.grade.name,
      guardianName: primary ? `${primary.firstName} ${primary.lastName}` : "—",
      tuition: num(fs.annualTuition), deposit: num(fs.registrationDeposit), transport: student.usesSchoolTransport ? num(fs.transportFee) : null,
      terms: year.terms.map((t) => ({ name: t.name, pct: t.feeSharePct, start: t.startDate })),
    });
    await prisma.parentSchoolContract.upsert({
      where: { studentId_academicYearId: { studentId, academicYearId: year.id } },
      update: { content, tuitionFee: num(fs.annualTuition), status: "DRAFT", signedAt: null, signedById: null },
      create: { studentId, academicYearId: year.id, content, tuitionFee: num(fs.annualTuition), status: "DRAFT" },
    });
    await audit(session.userId, "GENERATE_CONTRACT", "Student", studentId);
    revalidatePath(`/compliance/contracts/${studentId}`);
    return { success: "Contract generated." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function markContractSigned(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR");
    const studentId = str(fd, "studentId"), guardianId = opt(fd, "guardianId");
    const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!year) return { error: "No current academic year." };
    await prisma.parentSchoolContract.update({ where: { studentId_academicYearId: { studentId, academicYearId: year.id } }, data: { status: "SIGNED", signedAt: new Date(), signedById: guardianId } });
    await audit(session.userId, "SIGN_CONTRACT", "Student", studentId, { guardianId });
    revalidatePath(`/compliance/contracts/${studentId}`);
    revalidatePath("/compliance");
    return { success: "Marked as signed." };
  } catch (e) {
    return handleActionError(e);
  }
}
