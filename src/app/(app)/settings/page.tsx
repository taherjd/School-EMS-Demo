import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, toISODate } from "@/lib/format";
import { DSIB_RATING_LABEL } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td, label } from "@/components/ui";
import { createAcademicYear, createUser, resetPassword, saveSchool, setCurrentYear, toggleUser, updateTerm } from "./actions";
import type { DsibRating } from "@/generated/prisma/client";

const CURRICULA = ["UK", "US", "IB", "INDIAN_CBSE", "INDIAN_ICSE", "MOE", "FRENCH", "OTHER"];
const ROLES = ["ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT"];

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const [school, years, users, audits] = await Promise.all([
    prisma.school.findFirst(),
    prisma.academicYear.findMany({ include: { terms: { orderBy: { number: "asc" } } }, orderBy: { startDate: "desc" } }),
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: true } }),
  ]);
  return (
    <>
      <PageHeader title="Settings" subtitle="School profile (KHDA permit, curriculum), academic calendar, users and audit trail" />
      <Card title="School profile" className="mb-6">
        <ActionForm action={saveSchool} className="grid gap-4 md:grid-cols-3">
          <Field label="School name"><Input name="name" required defaultValue={school?.name} /></Field>
          <Field label="Name (Arabic)"><Input name="nameAr" dir="rtl" defaultValue={school?.nameAr ?? ""} /></Field>
          <Field label="KHDA permit / school ID"><Input name="khdaSchoolId" defaultValue={school?.khdaSchoolId ?? ""} /></Field>
          <Field label="Curriculum" hint="Sets the grade ladder and age-placement chart on first save."><Select name="curriculum" defaultValue={school?.curriculum ?? "UK"}>{CURRICULA.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
          <Field label="Academic year starts" hint="September schools: 31 Aug cut-off; April (Indian) schools: 31 Mar."><Select name="academicYearStart" defaultValue={school?.academicYearStart ?? "SEPTEMBER"}><option value="SEPTEMBER">September</option><option value="APRIL">April</option></Select></Field>
          <Field label="Last DSIB inspection rating"><Select name="lastDsibRating" defaultValue={school?.lastDsibRating ?? ""}><option value="">Not inspected</option>{(Object.keys(DSIB_RATING_LABEL) as DsibRating[]).map((r) => <option key={r} value={r}>{DSIB_RATING_LABEL[r]}</option>)}</Select></Field>
          <Field label="Principal"><Input name="principalName" defaultValue={school?.principalName ?? ""} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={school?.phone ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={school?.email ?? ""} /></Field>
          <Field label="Address" className="md:col-span-2"><Input name="address" defaultValue={school?.address ?? ""} /></Field>
          <Field label="KHDA fee framework approval ref."><Input name="feeFrameworkRef" defaultValue={school?.feeFrameworkRef ?? ""} /></Field>
          <div className="md:col-span-3"><Button>Save profile</Button></div>
        </ActionForm>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {years.map((y) => (
            <Card key={y.id} title={`${y.name} ${y.isCurrent ? "(current)" : ""}`} actions={!y.isCurrent && <form action={setCurrentYear}><input type="hidden" name="id" value={y.id} /><Button variant="secondary">Make current</Button></form>}>
              <p className="mb-2 text-xs text-gray-600">{fmtDate(y.startDate)} – {fmtDate(y.endDate)}</p>
              {y.terms.map((t) => (
                <ActionForm key={t.id} action={updateTerm} className="mb-2 grid grid-cols-12 items-end gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="col-span-2 text-sm font-medium">{t.name}</div>
                  <div className="col-span-3"><Input type="date" name="startDate" defaultValue={toISODate(t.startDate)} /></div>
                  <div className="col-span-3"><Input type="date" name="endDate" defaultValue={toISODate(t.endDate)} /></div>
                  <div className="col-span-2"><Input type="number" name="feeSharePct" defaultValue={t.feeSharePct} min={0} max={100} /></div>
                  <div className="col-span-2"><Button variant="secondary" className="w-full justify-center">Save</Button></div>
                </ActionForm>
              ))}
            </Card>
          ))}
        </div>
        <Card title="New academic year">
          <ActionForm action={createAcademicYear} className="space-y-2">
            <Input name="name" placeholder="2027-2028" required />
            <Field label="Start"><Input type="date" name="startDate" required /></Field>
            <Field label="End"><Input type="date" name="endDate" required /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isCurrent" /> Make current</label>
            <Button>Create</Button>
          </ActionForm>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Users">
            <Table head={["Name", "Email", "Role", "Status", "Actions"]}>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td><Td>{u.email}</Td><Td><Badge tone="blue">{label(u.role)}</Badge></Td>
                  <Td>{u.active ? <Badge tone="green">active</Badge> : <Badge tone="red">disabled</Badge>}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={toggleUser}><input type="hidden" name="id" value={u.id} /><button className="text-xs text-brand hover:underline">{u.active ? "disable" : "enable"}</button></form>
                      <ActionForm action={resetPassword} className="flex gap-1"><input type="hidden" name="id" value={u.id} /><Input name="password" type="password" placeholder="New password" className="max-w-36" /><button className="text-xs text-brand hover:underline">reset</button></ActionForm>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
        <Card title="Create user">
          <ActionForm action={createUser} className="space-y-2">
            <Input name="name" placeholder="Full name" required />
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Password (8+ chars)" required />
            <Select name="role">{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select>
            <Button>Create</Button>
          </ActionForm>
        </Card>
      </div>

      <Card title="Audit trail (latest 25)">
        <Table head={["When", "User", "Action", "Entity", "Details"]}>
          {audits.map((a) => (
            <tr key={a.id}><Td>{a.createdAt.toISOString().replace("T", " ").slice(0, 16)}</Td><Td>{a.user?.name ?? "system"}</Td><Td>{a.action}</Td><Td>{a.entity}{a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""}</Td><Td className="max-w-md truncate text-xs text-gray-500">{a.details ?? ""}</Td></tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
