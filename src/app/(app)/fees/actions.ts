"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { validateRegistrationDeposit } from "@/lib/khda";
import { num } from "@/lib/format";
import { date, numOrNull, opt, str } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";
import type { PaymentMethod } from "@/generated/prisma/client";

export async function saveFeeStructure(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "ACCOUNTANT");
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!year) return { error: "No current academic year." };
  const gradeId = str(fd, "gradeId");
  const annualTuition = numOrNull(fd, "annualTuition");
  const registrationDeposit = numOrNull(fd, "registrationDeposit");
  if (!gradeId || annualTuition === null || registrationDeposit === null) return { error: "Grade, tuition and deposit are required." };
  const check = validateRegistrationDeposit(annualTuition, registrationDeposit);
  if (!check.ok) return { error: `KHDA: registration deposit may not exceed 10% of annual tuition (max AED ${check.max.toFixed(2)}).` };
  const data = { annualTuition, registrationDeposit, khdaApprovalRef: opt(fd, "khdaApprovalRef"), transportFee: numOrNull(fd, "transportFee"), booksFee: numOrNull(fd, "booksFee"), uniformFee: numOrNull(fd, "uniformFee") };
  await prisma.feeStructure.upsert({ where: { academicYearId_gradeId: { academicYearId: year.id, gradeId } }, update: data, create: { ...data, academicYearId: year.id, gradeId } });
  await audit(session.userId, "SAVE_FEE_STRUCTURE", "FeeStructure", gradeId, data);
  revalidatePath("/fees");
  return { success: "Fee structure saved." };
}

export async function generateTermInvoices(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "ACCOUNTANT");
  const termId = str(fd, "termId");
  const dueDate = date(fd, "dueDate");
  if (!termId || !dueDate) return { error: "Term and due date are required." };
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (!term) return { error: "Term not found." };
  const students = await prisma.student.findMany({ where: { status: "ENROLLED", invoices: { none: { termId } } }, include: { grade: true } });
  const structures = await prisma.feeStructure.findMany({ where: { academicYearId: term.academicYearId } });
  const count = await prisma.invoice.count();
  let created = 0, skipped = 0;
  for (const s of students) {
    const fs = structures.find((f) => f.gradeId === s.gradeId);
    if (!fs) { skipped++; continue; }
    const annual = num(fs.annualTuition);
    const tuition = Math.round((annual * term.feeSharePct) / 100);
    const items: { type: "TUITION" | "REGISTRATION_DEPOSIT" | "TRANSPORT"; description: string; amount: number }[] = [
      { type: "TUITION", description: `${term.name} tuition (${term.feeSharePct}% of KHDA-approved annual fee AED ${annual.toLocaleString()})`, amount: tuition },
    ];
    if (term.number === 1) items.push({ type: "REGISTRATION_DEPOSIT", description: "Less: registration / re-registration deposit", amount: -num(fs.registrationDeposit) });
    if (s.usesSchoolTransport && fs.transportFee) items.push({ type: "TRANSPORT", description: `${term.name} transport`, amount: Math.round((num(fs.transportFee) * term.feeSharePct) / 100) });
    await prisma.invoice.create({
      data: { invoiceNo: `INV-${new Date().getFullYear()}-${String(count + created + 1).padStart(5, "0")}`, studentId: s.id, termId, dueDate, status: "ISSUED", items: { create: items } },
    });
    created++;
  }
  await audit(session.userId, "GENERATE_INVOICES", "Term", termId, { created, skipped });
  revalidatePath("/fees");
  return { success: `Created ${created} invoice(s)${skipped ? `, skipped ${skipped} student(s) without a fee structure` : ""}.` };
}

export async function recordPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN", "ACCOUNTANT");
  const invoiceId = str(fd, "invoiceId");
  const amount = numOrNull(fd, "amount");
  if (!invoiceId || !amount || amount <= 0) return { error: "Enter a positive amount." };
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, payments: true } });
  if (!inv) return { error: "Invoice not found." };
  const total = inv.items.reduce((a, i) => a + num(i.amount), 0);
  const paid = inv.payments.reduce((a, p) => a + num(p.amount), 0) + amount;
  if (paid > total + 0.005) return { error: `Payment exceeds balance (AED ${(total - paid + amount).toFixed(2)}).` };
  await prisma.payment.create({ data: { invoiceId, amount, method: (str(fd, "method") || "BANK_TRANSFER") as PaymentMethod, reference: opt(fd, "reference"), receivedBy: session.name, paidAt: date(fd, "paidAt") ?? new Date() } });
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: paid >= total - 0.005 ? "PAID" : "PARTIALLY_PAID" } });
  await audit(session.userId, "PAYMENT", "Invoice", invoiceId, { amount });
  revalidatePath(`/fees/invoices/${invoiceId}`);
  revalidatePath("/fees");
  return { success: "Payment recorded." };
}

export async function cancelInvoice(fd: FormData) {
  const session = await requireRole("ADMIN", "ACCOUNTANT");
  const id = str(fd, "id");
  await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(session.userId, "CANCEL", "Invoice", id);
  revalidatePath(`/fees/invoices/${id}`);
  revalidatePath("/fees");
}
