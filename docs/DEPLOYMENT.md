# Deployment guide

The app is a stateless Node/Next.js container plus PostgreSQL. Migrations run automatically on container start (`docker/entrypoint.sh` → `prisma migrate deploy`).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/sms?schema=public&sslmode=require` |
| `AUTH_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`); rotating it logs everyone out |
| `APP_URL` | yes | Public URL, e.g. `https://sms.yourschool.ae` |
| `SEED_DEMO_DATA` | no | `true` to load demo data on first start (never in production) |
| `SEED_PASSWORD` | no | Password for seeded demo accounts |

## Option A — single server with Docker Compose (recommended to start)

Suitable for one school. Use a VM in a UAE region (AWS `me-central-1`, Azure UAE North, Oracle Dubai, or a local provider) so student data stays in-country.

```bash
# on the server
sudo apt-get install -y docker.io docker-compose-plugin
sudo mkdir -p /opt/school-manager && cd /opt/school-manager
# copy docker-compose.yml and docker-compose.prod.yml here, then:
cat > .env <<'ENV'
POSTGRES_PASSWORD=<strong password>
AUTH_SECRET=<openssl rand -hex 32>
APP_URL=https://sms.yourschool.ae
DOMAIN=sms.yourschool.ae
ENV
# edit docker-compose.prod.yml: image: ghcr.io/<owner>/<repo>:latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Caddy obtains a TLS certificate automatically for `DOMAIN` (ports 80/443 must be open and DNS pointed at the server). Create the first admin user by running the seed once (`SEED_DEMO_DATA=true`) and then changing the passwords in Settings, or insert a user with `npx prisma db execute`.

### Continuous deployment

`.github/workflows/deploy.yml` builds and pushes the image to GitHub Container Registry on every `v*` tag (or manual run) and then SSHes into the server to `docker compose pull && up -d`. Configure:

- Repository variables: `DEPLOY_HOST`, `DEPLOY_USER`
- Repository secret: `DEPLOY_SSH_KEY` (private key for the deploy user)

## Option B — managed platform

Any platform that runs a Docker image works (AWS App Runner / ECS, Azure Container Apps, Render, Railway, Fly.io). Point `DATABASE_URL` at a managed PostgreSQL (AWS RDS in `me-central-1`, Azure Database for PostgreSQL in UAE North). Set the health check path to `/api/health`.

Vercel + a managed Postgres also works (`npm run build` runs `prisma generate`), but check the database provider's region list for UAE availability before choosing it: keeping student personal data in the UAE is the safe default under the PDPL and school regulator expectations.

## Backups and operations

- Nightly `pg_dump` to encrypted object storage in the same region; test a restore quarterly.
- Keep `AUTH_SECRET` and database credentials in the platform's secret store, never in git.
- Enable database SSL (`sslmode=require`) for managed databases.
- Review the audit trail (Settings → Audit) and export it periodically.
- Rotate demo accounts out before go-live: disable or delete every `@school.test` user.

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Run the Playwright suite against a running server with `npm run test:e2e` (set `PW_CHROMIUM_PATH` to reuse a system Chromium).
