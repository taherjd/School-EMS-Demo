import { ActionForm, type ActionState } from "@/components/action-form";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { toISODate } from "@/lib/format";
import type { Staff } from "@/generated/prisma/client";

const iso = (d: Date | null | undefined) => (d ? toISODate(d) : "");

export function StaffForm({ action, staff }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; staff?: Staff | null }) {
  const s = staff;
  return (
    <ActionForm action={action} className="space-y-6">
      <Card title="Personal details">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="First name"><Input name="firstName" required defaultValue={s?.firstName} /></Field>
          <Field label="Last name"><Input name="lastName" required defaultValue={s?.lastName} /></Field>
          <Field label="Name in Arabic"><Input name="nameAr" dir="rtl" defaultValue={s?.nameAr ?? ""} /></Field>
          <Field label="Gender"><Select name="gender" defaultValue={s?.gender ?? "FEMALE"}><option value="FEMALE">Female</option><option value="MALE">Male</option></Select></Field>
          <Field label="Date of birth"><Input type="date" name="dateOfBirth" defaultValue={iso(s?.dateOfBirth)} /></Field>
          <Field label="Nationality"><Input name="nationality" required defaultValue={s?.nationality} /></Field>
          <Field label="Emirates ID"><Input name="emiratesId" defaultValue={s?.emiratesId ?? ""} /></Field>
          <Field label="Emirates ID expiry"><Input type="date" name="emiratesIdExpiry" defaultValue={iso(s?.emiratesIdExpiry)} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={s?.phone ?? ""} /></Field>
          <Field label="Passport no."><Input name="passportNo" defaultValue={s?.passportNo ?? ""} /></Field>
          <Field label="Passport expiry"><Input type="date" name="passportExpiry" defaultValue={iso(s?.passportExpiry)} /></Field>
          <Field label="Visa expiry"><Input type="date" name="visaExpiry" defaultValue={iso(s?.visaExpiry)} /></Field>
        </div>
      </Card>
      <Card title="Employment & KHDA approval">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Position"><Input name="position" required defaultValue={s?.position} placeholder="Class Teacher / Head of Department" /></Field>
          <Field label="Join date"><Input type="date" name="joinDate" required defaultValue={iso(s?.joinDate)} /></Field>
          <Field label="Leave date"><Input type="date" name="leaveDate" defaultValue={iso(s?.leaveDate)} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isTeaching" defaultChecked={s ? s.isTeaching : true} /> Teaching role</label>
          <Field label="Highest qualification" hint="KHDA expects a relevant bachelor's degree for teachers."><Input name="highestQualification" defaultValue={s?.highestQualification ?? ""} /></Field>
          <Field label="Teaching qualification"><Input name="teachingQualification" defaultValue={s?.teachingQualification ?? ""} placeholder="PGCE / B.Ed" /></Field>
          <Field label="KHDA teacher approval ref."><Input name="khdaApprovalRef" defaultValue={s?.khdaApprovalRef ?? ""} /></Field>
          <Field label="UAE teacher licence status">
            <Select name="licenceStatus" defaultValue={s?.licenceStatus ?? "PENDING"}>
              {["PENDING", "PROVISIONAL", "LICENSED", "EXPIRED", "NOT_REQUIRED"].map((v) => <option key={v} value={v}>{v.replace("_", " ").toLowerCase()}</option>)}
            </Select>
          </Field>
          <Field label="Licence number"><Input name="licenceNo" defaultValue={s?.licenceNo ?? ""} /></Field>
          <Field label="Licence expiry"><Input type="date" name="licenceExpiry" defaultValue={iso(s?.licenceExpiry)} /></Field>
          {!s && <Field label="Login email (optional)" hint="Creates a system login for this staff member."><Input type="email" name="email" /></Field>}
          {!s && <Field label="Initial login password" hint="Required when an email is given; 8+ characters."><Input type="password" name="password" autoComplete="new-password" /></Field>}
        </div>
      </Card>
      <Button>{s ? "Save changes" : "Add staff member"}</Button>
    </ActionForm>
  );
}
