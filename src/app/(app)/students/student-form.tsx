import { ActionForm, type ActionState } from "@/components/action-form";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { toISODate } from "@/lib/format";
import type { Grade, Section, Student } from "@/generated/prisma/client";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  grades: Grade[];
  sections: (Section & { grade: Grade })[];
  student?: Student | null;
  cutoffLabel: string;
};

const iso = (d: Date | null | undefined) => (d ? toISODate(d) : "");

export function StudentForm({ action, grades, sections, student, cutoffLabel }: Props) {
  const s = student;
  return (
    <ActionForm action={action} className="space-y-6">
      <Card title="Student details">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="First name"><Input name="firstName" required defaultValue={s?.firstName} /></Field>
          <Field label="Last name"><Input name="lastName" required defaultValue={s?.lastName} /></Field>
          <Field label="Name in Arabic"><Input name="nameAr" dir="rtl" defaultValue={s?.nameAr ?? ""} /></Field>
          <Field label="Gender">
            <Select name="gender" defaultValue={s?.gender ?? "MALE"}><option value="MALE">Male</option><option value="FEMALE">Female</option></Select>
          </Field>
          <Field label="Date of birth" hint={`KHDA age placement is checked against the cut-off date (${cutoffLabel}).`}><Input name="dateOfBirth" type="date" required defaultValue={iso(s?.dateOfBirth)} /></Field>
          <Field label="Nationality" hint="Emirati students are flagged automatically."><Input name="nationality" required list="nats" defaultValue={s?.nationality} /></Field>
          <datalist id="nats">{["United Arab Emirates", "India", "Pakistan", "Egypt", "United Kingdom", "Philippines", "Jordan", "Lebanon", "Syria", "United States"].map((n) => <option key={n} value={n} />)}</datalist>
          <Field label="Grade / year group">
            <Select name="gradeId" required defaultValue={s?.gradeId ?? ""}>
              <option value="">Select…</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name} (min age {g.minAgeYears})</option>)}
            </Select>
          </Field>
          <Field label="Section (optional until enrolment)">
            <Select name="sectionId" defaultValue={s?.sectionId ?? ""}>
              <option value="">Unassigned</option>
              {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.grade.name} – {sec.name}</option>)}
            </Select>
          </Field>
          <Field label="Admission date"><Input name="admissionDate" type="date" required defaultValue={iso(s?.admissionDate) || toISODate(new Date())} /></Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="overrideAge" /> KHDA approval obtained for out-of-range age placement
        </label>
      </Card>

      <Card title="Identity documents (KHDA registration)">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Emirates ID" hint="784-YYYY-NNNNNNN-C"><Input name="emiratesId" placeholder="784-2019-1234567-1" defaultValue={s?.emiratesId ?? ""} /></Field>
          <Field label="Emirates ID expiry"><Input name="emiratesIdExpiry" type="date" defaultValue={iso(s?.emiratesIdExpiry)} /></Field>
          <div />
          <Field label="Passport number"><Input name="passportNo" defaultValue={s?.passportNo ?? ""} /></Field>
          <Field label="Passport expiry"><Input name="passportExpiry" type="date" defaultValue={iso(s?.passportExpiry)} /></Field>
          <div />
          <Field label="UAE residence visa no."><Input name="visaNo" defaultValue={s?.visaNo ?? ""} /></Field>
          <Field label="Visa expiry"><Input name="visaExpiry" type="date" defaultValue={iso(s?.visaExpiry)} /></Field>
        </div>
      </Card>

      <Card title="KHDA curriculum & inclusion flags">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isMuslim" defaultChecked={s?.isMuslim} /> Muslim – Islamic Education is compulsory</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="arabicFirstLanguage" defaultChecked={s?.arabicFirstLanguage} /> Arabic is the first language (Arabic A)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isStudentOfDetermination" defaultChecked={s?.isStudentOfDetermination} /> Student of determination (SEND)</label>
          <Field label="SEND category"><Input name="sendCategory" defaultValue={s?.sendCategory ?? ""} placeholder="e.g. Autism spectrum disorder" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isGifted" defaultChecked={s?.isGifted} /> Gifted and talented</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isEAL" defaultChecked={s?.isEAL} /> English as an additional language</label>
        </div>
      </Card>

      <Card title="Previous school & welfare">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Previous school"><Input name="previousSchool" defaultValue={s?.previousSchool ?? ""} /></Field>
          <Field label="Previous school country" hint="Transfer certificate must be attested if from outside the UAE."><Input name="previousSchoolCountry" defaultValue={s?.previousSchoolCountry ?? ""} /></Field>
          <Field label="Blood group"><Input name="bloodGroup" defaultValue={s?.bloodGroup ?? ""} /></Field>
          <Field label="Emergency contact name"><Input name="emergencyContactName" defaultValue={s?.emergencyContactName ?? ""} /></Field>
          <Field label="Emergency contact phone"><Input name="emergencyContactPhone" defaultValue={s?.emergencyContactPhone ?? ""} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="usesSchoolTransport" defaultChecked={s?.usesSchoolTransport} /> Uses school transport</label>
          <Field label="Medical notes" className="md:col-span-3"><Textarea name="medicalNotes" rows={2} defaultValue={s?.medicalNotes ?? ""} /></Field>
        </div>
      </Card>

      {!s && (
        <Card title="Primary guardian">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="First name"><Input name="gFirstName" required /></Field>
            <Field label="Last name"><Input name="gLastName" required /></Field>
            <Field label="Relationship"><Select name="gRelationship"><option>Father</option><option>Mother</option><option>Legal Guardian</option></Select></Field>
            <Field label="Mobile"><Input name="gPhone" required placeholder="+971 5x xxx xxxx" /></Field>
            <Field label="Email"><Input name="gEmail" type="email" /></Field>
            <Field label="Emirates ID"><Input name="gEmiratesId" /></Field>
            <Field label="Nationality"><Input name="gNationality" /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="gCreatePortal" /> Create parent portal login (email required)</label>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button>{s ? "Save changes" : "Submit admission"}</Button>
      </div>
    </ActionForm>
  );
}
