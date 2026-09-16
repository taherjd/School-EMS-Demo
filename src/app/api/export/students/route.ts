import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { formatEmiratesId } from "@/lib/khda";

/** CSV export of enrolled students in the shape KHDA registration uploads typically require. */
export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "REGISTRAR", "ACCOUNTANT"].includes(session.role)) return new NextResponse("Unauthorized", { status: 401 });
  const students = await prisma.student.findMany({ where: { status: { in: ["ENROLLED", "APPLICANT"] } }, include: { grade: true, section: true, guardians: { include: { guardian: true }, where: { isPrimary: true } } }, orderBy: [{ grade: { order: "asc" } }, { lastName: "asc" }] });
  const headers = ["StudentNo", "FirstName", "LastName", "NameArabic", "Gender", "DateOfBirth", "Nationality", "Emirati", "EmiratesID", "PassportNo", "VisaNo", "Grade", "Section", "Status", "AdmissionDate", "Muslim", "ArabicFirstLanguage", "StudentOfDetermination", "SENDCategory", "Gifted", "EAL", "PreviousSchool", "GuardianName", "GuardianPhone", "GuardianEmail", "GuardianEmiratesID"];
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = students.map((s) => {
    const g = s.guardians[0]?.guardian;
    return [s.studentNo, s.firstName, s.lastName, s.nameAr, s.gender, s.dateOfBirth.toISOString().slice(0, 10), s.nationality, s.isEmirati ? "Y" : "N", s.emiratesId ? formatEmiratesId(s.emiratesId) : "", s.passportNo, s.visaNo, s.grade.name, s.section?.name, s.status, s.admissionDate.toISOString().slice(0, 10), s.isMuslim ? "Y" : "N", s.arabicFirstLanguage ? "Y" : "N", s.isStudentOfDetermination ? "Y" : "N", s.sendCategory, s.isGifted ? "Y" : "N", s.isEAL ? "Y" : "N", s.previousSchool, g ? `${g.firstName} ${g.lastName}` : "", g?.phone, g?.email, g?.emiratesId ? formatEmiratesId(g.emiratesId) : ""].map(esc).join(",");
  });
  await audit(session.userId, "EXPORT_STUDENTS", "Student", null, { count: students.length });
  const csv = "﻿" + [headers.join(","), ...rows].join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="khda-students-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
