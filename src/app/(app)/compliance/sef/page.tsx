import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { DSIB_RATING_LABEL, DSIB_STANDARDS } from "@/lib/khda";
import { ActionForm } from "@/components/action-form";
import { Button, Card, PageHeader, Select, Textarea } from "@/components/ui";
import { saveSelfEvaluation } from "../actions";
import type { DsibRating } from "@/generated/prisma/client";

const RATINGS: DsibRating[] = ["OUTSTANDING", "VERY_GOOD", "GOOD", "ACCEPTABLE", "WEAK", "VERY_WEAK"];

export default async function SefPage() {
  await requireRole("ADMIN");
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const rows = year ? await prisma.selfEvaluation.findMany({ where: { academicYearId: year.id } }) : [];
  return (
    <>
      <PageHeader title="DSIB self-evaluation form (SEF)" subtitle="UAE School Inspection Framework: six performance standards on the six-point scale. Record your judgement, evidence and improvement actions per indicator." />
      <div className="space-y-6">
        {DSIB_STANDARDS.map((s) => (
          <Card key={s.number} title={`Standard ${s.number}: ${s.title}`}>
            <div className="space-y-4">
              {s.indicators.map((ind) => {
                const row = rows.find((r) => r.standard === s.number && r.indicator === ind);
                return (
                  <ActionForm key={ind} action={saveSelfEvaluation} className="grid gap-2 border-b border-gray-100 pb-3 md:grid-cols-12">
                    <input type="hidden" name="standard" value={s.number} />
                    <input type="hidden" name="indicator" value={ind} />
                    <div className="text-sm font-medium md:col-span-3">{ind}</div>
                    <div className="md:col-span-2"><Select name="rating" defaultValue={row?.rating ?? "ACCEPTABLE"}>{RATINGS.map((r) => <option key={r} value={r}>{DSIB_RATING_LABEL[r]}</option>)}</Select></div>
                    <div className="md:col-span-3"><Textarea name="evidence" rows={2} placeholder="Evidence" defaultValue={row?.evidence ?? ""} /></div>
                    <div className="md:col-span-3"><Textarea name="actions" rows={2} placeholder="Improvement actions" defaultValue={row?.actions ?? ""} /></div>
                    <div className="md:col-span-1"><Button variant="secondary" className="w-full justify-center">Save</Button></div>
                  </ActionForm>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
