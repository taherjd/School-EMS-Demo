# Plan: KHDA-aligned online school management system

## 1. Goal

Give a Dubai private school one system that runs day-to-day operations **and** keeps the school
continuously ready for KHDA obligations: student registration data, teacher approvals and licensing,
mandatory curriculum, attendance, the fee framework, the Parent–School Contract, inclusion, safeguarding
and DSIB inspection evidence.

## 2. Users and roles

| Role | Needs |
|---|---|
| Admin (principal / operations) | Everything; school profile, calendar, users, DSIB self-evaluation |
| Registrar | Admissions, student records, documents, staff records, contracts, KHDA exports |
| Accountant | Fee structure, invoices, payments, refunds |
| Teacher | Own sections: attendance registers, assessments, IEP notes, incident logs |
| Parent / student | Portal: attendance, results, invoices, contract status |

Role gating is enforced twice: in `src/proxy.ts` (route level) and inside every server action (`requireRole`).

## 3. Architecture

```
Browser ──▶ Next.js 16 (App Router)
             ├── Server Components: read from PostgreSQL via Prisma (no client data fetching)
             ├── Server Actions: validated mutations (Zod) + audit log
             ├── proxy.ts: session cookie check + role → path allow-list
             └── /api/health, /api/export/students (CSV)
PostgreSQL 16 ◀── Prisma 7 (pg driver adapter), migrations in prisma/migrations
```

Design choices:

- **Single-tenant per deployment.** One `School` row; simpler data isolation for UAE PDPL and KHDA audits. Multi-school groups run one instance per school (or per KHDA permit).
- **Server-first.** Pages are server-rendered on demand; no client state library. Forms post to server actions and keep user input on validation errors.
- **KHDA rules isolated.** `src/lib/khda.ts` holds every regulatory constant (age chart, deposit cap, term split, refund rule, ECI multipliers, attendance bands, mandatory subjects, DSIB standards, Emirates ID validation). `src/lib/compliance.ts` turns them into findings.
- **Audit trail.** Every mutation writes an `AuditLog` row (who, what, entity, details).
- **Bilingual, RTL-ready.** Locale cookie switches `lang`/`dir`; navigation and common labels are translated, Arabic name fields exist on students, staff, subjects and the school.

## 4. Data model (prisma/schema.prisma)

Core: `School`, `AcademicYear` → `Term` (fee share %), `User`, `Staff`, `Guardian`, `Grade` (KHDA min age), `Section`, `Student` (KHDA flags: Emirati, Muslim, Arabic first language, student of determination, gifted, EAL; identity documents with expiries), `StudentGuardian`, `StudentDocument`.

Academics: `Subject` (KHDA-mandatory + applicability), `CurriculumRequirement` (minimum weekly periods per grade), `TeachingAssignment`, `TimetableSlot`, `Attendance`, `Assessment`, `AssessmentResult`.

Fees: `FeeStructure` (approved tuition, deposit ≤ 10%, KHDA approval ref), `Invoice`, `InvoiceItem`, `Payment`.

Compliance & wellbeing: `ParentSchoolContract`, `Iep`, `Incident`, `SelfEvaluation` (DSIB), `AuditLog`.

## 5. Modules and status

| Module | Delivered in this version | Next |
|---|---|---|
| Auth & roles | Login, sessions, 6 roles, route + action guards, user admin, password reset | SSO (UAE Pass / Microsoft Entra), MFA |
| Dashboard | KPIs, compliance findings, enrolment by grade, term calendar | Charts, trend history |
| Students | List/filter/search, admission form with KHDA age-placement & Emirates ID checks, document checklist with expiries, guardians (+ portal login), enrol with capacity check, withdraw/transfer with refund note, edit | File uploads for documents, KHDA transfer-certificate workflow, bulk import |
| Staff | Records, KHDA approval ref, UAE teacher licence status/expiry, visa/EID expiry, teaching load | HR (leave, appraisal), qualification attestation tracking |
| Academics | Sections, subjects, KHDA minimum periods per grade, assignments with licence check, timetable with clash detection, compliance warnings | Auto-timetabling, room management, curriculum maps |
| Attendance | Daily register per section, weekend guard, 30-day bands vs DSIB thresholds, persistent-absence follow-up | Lesson-level attendance, SMS/email alerts to parents |
| Assessments | Internal/external assessments, mark entry with auto grade, class statistics | Report cards (PDF), progress tracking vs external benchmarks, DSIB attainment/progress analytics |
| Fees | Fee structure with deposit cap, term invoice generation, payments, invoice view, refund calculator, ECI fee-increase ceiling | Online payment gateway, receipts PDF, VAT on non-tuition items, dunning |
| Compliance | Findings report, missing/expiring documents, licences, curriculum minimums, inclusion, contracts, DSIB SEF, CSV export | Evidence uploads, KHDA data-return templates, inspection-readiness scoring |
| Parent portal | Children overview, attendance, results, invoices, contract status | Messaging, consent forms, online payments |
| Settings | School profile (permit, curriculum, DSIB rating), academic years/terms, users, audit trail | Notification settings, custom fields |

## 6. Roadmap (suggested)

1. **Pilot (now → 4 weeks):** load real grade ladder/fee structure, verify constants against current KHDA circulars, import students (CSV), run one term.
2. **Phase 2 (1–2 months):** document uploads to object storage in a UAE region, PDF report cards/receipts, parent notifications, payment gateway (e.g. Network International / Telr / Stripe UAE).
3. **Phase 3 (2–4 months):** analytics for DSIB (attainment, progress by group: Emirati, SoD, EAL, gender), wellbeing census support, integrations (KHDA data returns, accounting, MoE licensing).
4. **Hardening:** MFA/SSO, penetration test, PDPL data-protection impact assessment, backup/restore drills.

## 7. Quality gates

- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, `npm run test:e2e` — all wired into GitHub Actions (`.github/workflows/ci.yml`).
- Playwright suite exercises login, role restrictions, admission validation, enrolment, attendance, payments, deposit cap, contract generation/signing, portal isolation and CSV export.
