# Dubai School Manager

An online school management system for private schools regulated by the **KHDA** (Knowledge and Human Development Authority, Dubai). It covers admissions and student records, staff and teacher licensing, academics and timetabling, attendance, assessments, fees under the KHDA fee framework, inclusion (IEPs), safeguarding logs, the Parent–School Contract, DSIB self-evaluation, and a parent portal — with an English/Arabic (RTL) interface.

- **Plan & architecture:** [docs/PLAN.md](docs/PLAN.md)
- **KHDA compliance mapping:** [docs/KHDA-COMPLIANCE.md](docs/KHDA-COMPLIANCE.md)
- **Deployment guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Stack

| Layer | Choice |
|---|---|
| Web framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Signed session cookie (JWT, `jose`) + bcrypt passwords, role-based access in `src/proxy.ts` |
| Validation | Zod |
| Tests | `node:test` unit tests for KHDA rules, Playwright end-to-end suite |
| Deploy | Docker multi-stage image, docker compose (+ Caddy TLS), GitHub Actions CI/CD |

## Quick start (local)

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET
npm install                     # also runs `prisma generate`
npx prisma migrate deploy       # create the schema
npx prisma db seed              # demo school, users, students, fees…
npm run dev                     # http://localhost:3000
```

Or with Docker (app + PostgreSQL):

```bash
AUTH_SECRET=$(openssl rand -hex 32) SEED_DEMO_DATA=true docker compose up --build
```

### Demo accounts (seeded, password `Password123!`)

| Role | Email |
|---|---|
| Admin | admin@school.test |
| Registrar | registrar@school.test |
| Accountant | accounts@school.test |
| Teacher | aisha.khan@school.test |
| Parent | parent@school.test |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run test:unit` | KHDA rule unit tests (age placement, fees, refunds, Emirates ID…) |
| `npm run test:e2e` | Playwright suite against a running server (`E2E_BASE_URL`, `PW_CHROMIUM_PATH` optional) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Prisma migrations and seeding |

## Project layout

```
prisma/schema.prisma        data model (KHDA-flagged fields are commented)
prisma/seed.ts              demo data
src/lib/khda.ts             KHDA business rules and constants (single place to update)
src/lib/compliance.ts       compliance checks that feed the dashboard and report
src/lib/auth.ts             sessions, login, role guards
src/proxy.ts                route protection by role
src/app/(app)/*             modules: dashboard, students, staff, academics, attendance,
                            assessments, fees, compliance, settings, portal
src/app/api/*               health check, KHDA CSV export
e2e/, tests/                Playwright and unit tests
docker/, Dockerfile, docker-compose*.yml, .github/workflows   deployment
```

## Important note on KHDA rules

KHDA publishes and revises its requirements through circulars and frameworks (age placement chart, fee framework, Parent–School Contract, inspection framework). The rules implemented here reflect those frameworks as generally applied, and every constant lives in `src/lib/khda.ts` so it can be verified against the current KHDA circular before go-live. See [docs/KHDA-COMPLIANCE.md](docs/KHDA-COMPLIANCE.md) for the list of items to confirm with KHDA.
