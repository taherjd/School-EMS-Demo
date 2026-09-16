# KHDA compliance mapping

How KHDA (Dubai) requirements map to features in this system. **Verify every constant marked ⚠ against the current KHDA circular before go-live** — all of them live in `src/lib/khda.ts`.

| Requirement | Implementation | Where |
|---|---|---|
| Student registration data (Emirates ID, passport, visa, nationality, DOB, gender, grade, Emirati flag) | Fields on `Student`; Emirates ID validated (784 prefix, 15 digits, Luhn); CSV export for KHDA uploads | `src/lib/khda.ts`, `/students`, `/api/export/students` |
| Age placement chart (min age on cut-off date; 31 Aug for September schools, 31 Mar for April schools) ⚠ | Grade ladders per curriculum with minimum ages; admission and edit forms reject too-young placements and require an explicit "KHDA approval obtained" tick when a student is more than 2 years above the minimum | `GRADE_CATALOGUE`, `checkAgePlacement`, `/students/new` |
| Required documents on file (Emirates ID, passport, visa, birth certificate, transfer certificate, immunisation, photo) | Per-student checklist with status and expiry; enrolment blocks on missing core documents unless overridden; compliance report lists missing/expiring | `REQUIRED_STUDENT_DOCUMENTS`, `/students/[id]`, `/compliance` |
| Mandatory subjects: Arabic (A for native speakers, B for others), Islamic Education (Muslim students), UAE Social Studies, Moral/Social/Cultural Studies; minimum weekly periods ⚠ | Subjects flagged KHDA-mandatory with applicability rules; `CurriculumRequirement` per grade; compliance check compares timetabled periods per section against minimums, considering the students actually in the section | `MANDATORY_SUBJECTS`, `curriculumCompliance`, `/academics` |
| Teacher approval and UAE teacher licensing | `Staff.khdaApprovalRef`, licence status/number/expiry; unlicensed/expired flagged; assignment blocked for expired licences | `/staff`, `/academics/sections/[id]` |
| Staff and student document expiries (visa, Emirates ID) | 60-day expiry warnings on dashboard and compliance page | `expiringDocuments` |
| Fee framework: KHDA-approved tuition per grade, deposit ≤ 10% of tuition deducted from term 1, fees in up to three instalments ⚠ | `FeeStructure` with approval ref; deposit cap enforced on save; terms carry fee share % (default 40/30/30); invoice generator | `MAX_REGISTRATION_DEPOSIT_RATIO`, `DEFAULT_TERM_FEE_SPLIT`, `/fees` |
| Fee increase ceiling = ECI × multiplier by inspection rating ⚠ | Calculator on the fees page using the school's last DSIB rating | `FEE_INCREASE_MULTIPLIER` |
| Refund policy on withdrawal (≤2 weeks: one month's fee; ≤1 month: two months'; >1 month: full term) ⚠ | Refund calculator; withdrawal action records the computed position in the audit log | `computeTermRefund`, `/fees/refund` |
| Parent–School Contract per student per year | Generated from school profile, fee structure and term plan; draft → signed with guardian and timestamp; unsigned contracts reported | `/compliance/contracts/[studentId]` |
| Attendance records and follow-up | Daily registers, Monday–Friday guard, 30-day attendance vs DSIB bands ⚠, repeated-absence list | `/attendance` |
| Inclusion (Dubai Inclusive Education Policy Framework): register of students of determination, IEPs, reviews | SoD flag and category, IEP with targets/provisions/review date; students without an active IEP or with overdue reviews are findings | `/students/[id]`, `inclusionCompliance` |
| Safeguarding and wellbeing evidence | Incident log by type/severity with actions and resolution | `/students/[id]` |
| DSIB inspection framework self-evaluation (6 standards, 6-point scale) | SEF page per indicator with rating, evidence, actions; summary on compliance page | `DSIB_STANDARDS`, `/compliance/sef` |
| Emirati, SoD, gifted, EAL reporting groups | Flags on students, filters in the list, counts on dashboard | `/students?flag=` |
| Personal data protection (UAE Federal Decree-Law 45/2021) | Role-based access, audit trail, httpOnly sessions; deployment guide recommends UAE-region hosting and encrypted backups | `docs/DEPLOYMENT.md` |
| Bilingual communication | Arabic/English UI toggle with RTL, Arabic name fields | `src/lib/i18n.ts` |

## Items to confirm with KHDA before go-live

1. Age placement minimums per grade for your curriculum and the current cut-off dates.
2. Minimum weekly periods for Arabic A/B, Islamic Education, UAE Social Studies and Moral Studies per phase.
3. Current ECI value and rating multipliers for fee increases; your approved fee schedule reference.
4. The exact refund wording in the current Parent–School Contract template and any updates to deposit rules.
5. Attendance thresholds used by DSIB in the current inspection cycle.
6. Any additional data fields required by the KHDA student registration / data-return system for your school type.

## Out of scope in this version

Direct API integration with KHDA systems (student registration, transfer certificates, teacher approvals) — these are handled through the CSV export and manual submission. File storage for scanned documents. Online fee payments.
