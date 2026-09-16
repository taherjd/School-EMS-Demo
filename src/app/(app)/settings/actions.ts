"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { GRADE_CATALOGUE, DEFAULT_TERM_FEE_SPLIT } from "@/lib/khda";
import { bool, date, numOrNull, opt, str, handleActionError } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { AcademicYearStart, Curriculum, DsibRating, Role } from "@/generated/prisma/client";

export async function saveSchool(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN");
    const name = str(fd, "name");
    if (!name) return { error: "School name is required." };
    const data = {
      name, nameAr: opt(fd, "nameAr"), khdaSchoolId: opt(fd, "khdaSchoolId"),
      curriculum: str(fd, "curriculum") as Curriculum, academicYearStart: str(fd, "academicYearStart") as AcademicYearStart,
      address: opt(fd, "address"), phone: opt(fd, "phone"), email: opt(fd, "email"), principalName: opt(fd, "principalName"),
      feeFrameworkRef: opt(fd, "feeFrameworkRef"), lastDsibRating: (opt(fd, "lastDsibRating") as DsibRating | null),
    };
    const existing = await prisma.school.findFirst();
    const school = existing ? await prisma.school.update({ where: { id: existing.id }, data }) : await prisma.school.create({ data });
    // Seed the grade ladder for the curriculum if none exists yet
    if ((await prisma.grade.count()) === 0) {
      await prisma.grade.createMany({ data: GRADE_CATALOGUE[school.curriculum] });
    }
    await audit(session.userId, "SAVE_SCHOOL", "School", school.id);
    revalidatePath("/", "layout");
    return { success: "School profile saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createAcademicYear(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN");
    const name = str(fd, "name"), start = date(fd, "startDate"), end = date(fd, "endDate");
    if (!name || !start || !end || end <= start) return { error: "Provide a name and a valid date range." };
    const makeCurrent = bool(fd, "isCurrent");
    const span = end.getTime() - start.getTime();
    const terms = DEFAULT_TERM_FEE_SPLIT.map((pct, i) => ({
      number: i + 1, name: `Term ${i + 1}`, feeSharePct: pct,
      startDate: new Date(start.getTime() + (span * i) / 3),
      endDate: new Date(start.getTime() + (span * (i + 1)) / 3 - 86_400_000),
    }));
    try {
      if (makeCurrent) await prisma.academicYear.updateMany({ data: { isCurrent: false } });
      const y = await prisma.academicYear.create({ data: { name, startDate: start, endDate: end, isCurrent: makeCurrent, terms: { create: terms } } });
      await audit(session.userId, "CREATE", "AcademicYear", y.id);
    } catch {
      return { error: "An academic year with that name already exists." };
    }
    revalidatePath("/settings");
    return { success: "Academic year created with three terms (edit dates and fee shares below)." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateTerm(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireRole("ADMIN");
    const id = str(fd, "id"), start = date(fd, "startDate"), end = date(fd, "endDate"), pct = numOrNull(fd, "feeSharePct");
    if (!id || !start || !end || pct === null) return { error: "All term fields are required." };
    await prisma.term.update({ where: { id }, data: { startDate: start, endDate: end, feeSharePct: pct } });
    const term = await prisma.term.findUnique({ where: { id }, include: { academicYear: { include: { terms: true } } } });
    const sum = term?.academicYear.terms.reduce((a, t) => a + t.feeSharePct, 0) ?? 0;
    revalidatePath("/settings");
    return sum === 100 ? { success: "Term updated." } : { success: `Term updated. Note: fee shares currently total ${sum}% (should be 100%).` };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function setCurrentYear(fd: FormData) {
  try {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    await prisma.$transaction([prisma.academicYear.updateMany({ data: { isCurrent: false } }), prisma.academicYear.update({ where: { id }, data: { isCurrent: true } })]);
    revalidatePath("/", "layout");
  } catch (e) {
    handleActionError(e);
  }
}

export async function createUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN");
    const email = str(fd, "email").toLowerCase(), name = str(fd, "name"), password = str(fd, "password");
    const role = str(fd, "role") as Role;
    if (!email || !name || password.length < 8) return { error: "Email, name and a password of 8+ characters are required." };
    try {
      const u = await prisma.user.create({ data: { email, name, role, passwordHash: await hashPassword(password) } });
      await audit(session.userId, "CREATE", "User", u.id, { role });
    } catch {
      return { error: "A user with that email already exists." };
    }
    revalidatePath("/settings");
    return { success: "User created." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function toggleUser(fd: FormData) {
  try {
    const session = await requireRole("ADMIN");
    const id = str(fd, "id");
    if (id === session.userId) return;
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return;
    await prisma.user.update({ where: { id }, data: { active: !u.active } });
    await audit(session.userId, u.active ? "DEACTIVATE" : "ACTIVATE", "User", id);
    revalidatePath("/settings");
  } catch (e) {
    handleActionError(e);
  }
}

export async function resetPassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN");
    const id = str(fd, "id"), password = str(fd, "password");
    if (password.length < 8) return { error: "Password must be 8+ characters." };
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    await audit(session.userId, "RESET_PASSWORD", "User", id);
    return { success: "Password reset." };
  } catch (e) {
    return handleActionError(e);
  }
}
