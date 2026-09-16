"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isValidEmiratesId, normaliseEmiratesId } from "@/lib/khda";
import { bool, date, opt, str, zodError } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nameAr: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.date().nullable(),
  nationality: z.string().min(1),
  emiratesId: z.string().nullable(),
  emiratesIdExpiry: z.date().nullable(),
  passportNo: z.string().nullable(),
  passportExpiry: z.date().nullable(),
  visaExpiry: z.date().nullable(),
  position: z.string().min(1),
  isTeaching: z.boolean(),
  highestQualification: z.string().nullable(),
  teachingQualification: z.string().nullable(),
  khdaApprovalRef: z.string().nullable(),
  licenceStatus: z.enum(["NOT_REQUIRED", "PENDING", "PROVISIONAL", "LICENSED", "EXPIRED"]),
  licenceNo: z.string().nullable(),
  licenceExpiry: z.date().nullable(),
  joinDate: z.date({ error: "Join date is required" }),
  leaveDate: z.date().nullable(),
  phone: z.string().nullable(),
});

function parse(fd: FormData) {
  return schema.safeParse({
    firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), nameAr: opt(fd, "nameAr"), gender: str(fd, "gender"),
    dateOfBirth: date(fd, "dateOfBirth"), nationality: str(fd, "nationality"), emiratesId: opt(fd, "emiratesId"), emiratesIdExpiry: date(fd, "emiratesIdExpiry"),
    passportNo: opt(fd, "passportNo"), passportExpiry: date(fd, "passportExpiry"), visaExpiry: date(fd, "visaExpiry"), position: str(fd, "position"),
    isTeaching: bool(fd, "isTeaching"), highestQualification: opt(fd, "highestQualification"), teachingQualification: opt(fd, "teachingQualification"),
    khdaApprovalRef: opt(fd, "khdaApprovalRef"), licenceStatus: str(fd, "licenceStatus"), licenceNo: opt(fd, "licenceNo"), licenceExpiry: date(fd, "licenceExpiry"),
    joinDate: date(fd, "joinDate"), leaveDate: date(fd, "leaveDate"), phone: opt(fd, "phone"),
  });
}

export async function saveStaff(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "REGISTRAR");
  const parsed = parse(fd);
  if (!parsed.success) return zodError(parsed.error);
  const data = parsed.data;
  if (data.emiratesId && !isValidEmiratesId(data.emiratesId)) return { error: "Emirates ID is not valid." };
  if (data.isTeaching && data.licenceStatus === "NOT_REQUIRED") return { error: "Teaching staff require a UAE teacher licence status other than 'Not required'." };
  const payload = { ...data, emiratesId: data.emiratesId ? normaliseEmiratesId(data.emiratesId) : null };

  if (id) {
    await prisma.staff.update({ where: { id }, data: payload });
    await audit(session.userId, "UPDATE", "Staff", id);
    revalidatePath(`/staff/${id}`);
    redirect(`/staff/${id}`);
  }

  const email = opt(fd, "email");
  let userId: string | null = null;
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return { error: "A user with this email already exists." };
    const temp = `Staff-${Math.random().toString(36).slice(2, 8)}!`;
    const u = await prisma.user.create({ data: { email: email.toLowerCase(), passwordHash: await hashPassword(temp), name: `${data.firstName} ${data.lastName}`, role: data.isTeaching ? "TEACHER" : "REGISTRAR" } });
    userId = u.id;
    console.info(`Staff login created for ${email} with temporary password ${temp}`);
  }
  const count = await prisma.staff.count();
  const staff = await prisma.staff.create({ data: { ...payload, userId, staffNo: `STF-${String(count + 1).padStart(4, "0")}` } });
  await audit(session.userId, "CREATE", "Staff", staff.id);
  revalidatePath("/staff");
  redirect(`/staff/${staff.id}`);
}
