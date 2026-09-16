"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { date, str, handleActionError } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { AttendanceStatus } from "@/generated/prisma/client";

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "MEDICAL"];

export async function saveRegister(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await requireRole("ADMIN", "REGISTRAR", "TEACHER");
    const sectionId = str(fd, "sectionId");
    const day = date(fd, "date");
    if (!sectionId || !day) return { error: "Section and date are required." };
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) return { error: "Selected date falls on the weekend (UAE school week is Monday–Friday)." };
    const students = await prisma.student.findMany({ where: { sectionId, status: "ENROLLED" }, select: { id: true } });
    let n = 0;
    await prisma.$transaction(
      students.map((s) => {
        const status = str(fd, `status-${s.id}`) as AttendanceStatus;
        const remarks = str(fd, `remarks-${s.id}`) || null;
        if (!STATUSES.includes(status)) return prisma.attendance.findFirst({ where: { id: "noop" } });
        n++;
        return prisma.attendance.upsert({
          where: { studentId_date: { studentId: s.id, date: day } },
          update: { status, remarks, recordedBy: session.name },
          create: { studentId: s.id, date: day, status, remarks, recordedBy: session.name },
        });
      }),
    );
    await audit(session.userId, "SAVE_REGISTER", "Section", sectionId, { date: day.toISOString().slice(0, 10), count: n });
    revalidatePath("/attendance");
    return { success: `Register saved for ${n} student(s).` };
  } catch (e) {
    return handleActionError(e);
  }
}
