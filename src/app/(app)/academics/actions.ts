"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { numOrNull, opt, str, bool } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { SubjectApplicability } from "@/generated/prisma/client";

export async function createSection(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR");
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!year) return { error: "No current academic year." };
  const gradeId = str(fd, "gradeId"), name = str(fd, "name");
  if (!gradeId || !name) return { error: "Grade and section name are required." };
  try {
    const s = await prisma.section.create({ data: { gradeId, name, academicYearId: year.id, capacity: numOrNull(fd, "capacity") ?? 25, homeroomTeacherId: opt(fd, "homeroomTeacherId") } });
    await audit(session.userId, "CREATE", "Section", s.id);
  } catch {
    return { error: "A section with that name already exists for this grade." };
  }
  revalidatePath("/academics");
  return { success: "Section created." };
}

export async function createSubject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR");
  const code = str(fd, "code").toUpperCase(), name = str(fd, "name");
  if (!code || !name) return { error: "Code and name are required." };
  try {
    const s = await prisma.subject.create({ data: { code, name, nameAr: opt(fd, "nameAr"), isKhdaMandatory: bool(fd, "isKhdaMandatory"), applicability: (str(fd, "applicability") || "ALL") as SubjectApplicability } });
    await audit(session.userId, "CREATE", "Subject", s.id);
  } catch {
    return { error: "Subject code already exists." };
  }
  revalidatePath("/academics");
  return { success: "Subject created." };
}

export async function saveAssignment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR");
  const sectionId = str(fd, "sectionId"), subjectId = str(fd, "subjectId"), teacherId = str(fd, "teacherId");
  const weeklyPeriods = numOrNull(fd, "weeklyPeriods") ?? 0;
  if (!sectionId || !subjectId || !teacherId) return { error: "Subject and teacher are required." };
  const teacher = await prisma.staff.findUnique({ where: { id: teacherId } });
  if (!teacher?.isTeaching) return { error: "Selected staff member is not a teacher." };
  if (teacher.licenceStatus === "EXPIRED") return { error: "Teacher's UAE licence has expired – renew before assigning classes." };
  await prisma.teachingAssignment.upsert({
    where: { sectionId_subjectId: { sectionId, subjectId } },
    update: { teacherId, weeklyPeriods },
    create: { sectionId, subjectId, teacherId, weeklyPeriods },
  });
  await audit(session.userId, "SAVE_ASSIGNMENT", "Section", sectionId, { subjectId, teacherId, weeklyPeriods });
  revalidatePath(`/academics/sections/${sectionId}`);
  revalidatePath("/academics");
  return { success: "Assignment saved." };
}

export async function removeAssignment(fd: FormData) {
  const session = await requireRole("ADMIN", "REGISTRAR");
  const id = str(fd, "id"), sectionId = str(fd, "sectionId");
  await prisma.teachingAssignment.delete({ where: { id } });
  await audit(session.userId, "REMOVE_ASSIGNMENT", "Section", sectionId, { id });
  revalidatePath(`/academics/sections/${sectionId}`);
}

export async function saveSlot(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN", "REGISTRAR");
  const assignmentId = str(fd, "assignmentId"), sectionId = str(fd, "sectionId");
  const dayOfWeek = numOrNull(fd, "dayOfWeek"), period = numOrNull(fd, "period");
  if (!assignmentId || !dayOfWeek || !period) return { error: "Subject, day and period are required." };
  // clash check: same section, same day/period
  const clash = await prisma.timetableSlot.findFirst({ where: { dayOfWeek, period, assignment: { sectionId } }, include: { assignment: { include: { subject: true } } } });
  if (clash) return { error: `Slot already used by ${clash.assignment.subject.name}.` };
  const a = await prisma.teachingAssignment.findUnique({ where: { id: assignmentId } });
  const teacherClash = await prisma.timetableSlot.findFirst({ where: { dayOfWeek, period, assignment: { teacherId: a?.teacherId } }, include: { assignment: { include: { section: { include: { grade: true } } } } } });
  if (teacherClash) return { error: `Teacher is already timetabled in ${teacherClash.assignment.section.grade.name} ${teacherClash.assignment.section.name} at that time.` };
  await prisma.timetableSlot.create({ data: { assignmentId, dayOfWeek, period, room: opt(fd, "room") } });
  revalidatePath(`/academics/sections/${sectionId}`);
  return { success: "Slot added." };
}

export async function removeSlot(fd: FormData) {
  await requireRole("ADMIN", "REGISTRAR");
  await prisma.timetableSlot.delete({ where: { id: str(fd, "id") } });
  revalidatePath(`/academics/sections/${str(fd, "sectionId")}`);
}
