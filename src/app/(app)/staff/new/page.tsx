import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StaffForm } from "../staff-form";
import { saveStaff } from "../actions";

export default async function NewStaffPage() {
  await requireRole("ADMIN", "REGISTRAR");
  return (
    <>
      <PageHeader title="Add staff member" />
      <StaffForm action={saveStaff.bind(null, null)} />
    </>
  );
}
