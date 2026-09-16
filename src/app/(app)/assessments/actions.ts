"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { date, numOrNull, opt, str } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import { gradeFor } from "@/lib/grading";
import type { AssessmentType } from "@/generated/prisma/client";

export async function createAssessment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const name = str(fd, "name"), sectionId = str(fd, "sectionId"), subjectId = str(fd, "subjectId"), termId = str(fd, "termId");
  const when = date(fd, "date");
  if (!name || !sectionId || !subjectId || !termId || !when) return { error: "All fields are required." };
  const a = await prisma.assessment.create({ data: { name, sectionId, subjectId, termId, date: when, type: str(fd, "type") as AssessmentType, maxMarks: numOrNull(fd, "maxMarks") ?? 100 } });
  await audit(session.userId, "CREATE", "Assessment", a.id);
  revalidatePath("/assessments");
  redirect(`/assessments/${a.id}`);
}

export async function saveResults(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
  const assessmentId = str(fd, "assessmentId");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId }, include: { section: { include: { students: { where: { status: "ENROLLED" }, select: { id: true } } } } } });
  if (!assessment) return { error: "Assessment not found" };
  let n = 0;
  for (const s of assessment.section.students) {
    const marks = numOrNull(fd, `marks-${s.id}`);
    if (marks === null) continue;
    if (marks < 0 || marks > assessment.maxMarks) return { error: `Marks must be between 0 and ${assessment.maxMarks}.` };
    const pct = (marks / assessment.maxMarks) * 100;
    await prisma.assessmentResult.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId: s.id } },
      update: { marks, gradeLabel: gradeFor(pct), comment: opt(fd, `comment-${s.id}`) },
      create: { assessmentId, studentId: s.id, marks, gradeLabel: gradeFor(pct), comment: opt(fd, `comment-${s.id}`) },
    });
    n++;
  }
  await audit(session.userId, "SAVE_RESULTS", "Assessment", assessmentId, { count: n });
  revalidatePath(`/assessments/${assessmentId}`);
  return { success: `Saved ${n} result(s).` };
}
