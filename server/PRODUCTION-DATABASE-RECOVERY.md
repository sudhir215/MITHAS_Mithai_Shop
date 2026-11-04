# Production database connection and recovery

This runbook describes the intended Neon configuration for MITHAS. It does not
assert that backups, restore points, or production access have been verified.
Do not connect to or change the production database as part of this document.

## Connection strategy

- `DATABASE_URL` is the runtime URL. Configure it with the Neon **pooled**
  endpoint for the production project, branch, and `neondb`; retain TLS
  (`sslmode=require`). The backend passes this URL to `@prisma/adapter-pg`.
- The runtime pool is capped at five connections per server process, with a
  10-second idle timeout and a 5-second connection timeout. Account for the
  total across all simultaneously running application instances and adjust the
  cap only after checking the deployment's concurrency and Neon limits.
- `DIRECT_URL` is the direct (non-pooled) Neon endpoint for Prisma CLI
  operations that require a direct connection. In Prisma 7 this project reads
  that variable as `datasource.url` in `prisma.config.js`; Prisma 7 does not
  use the old schema-level `directUrl` field here. Do not use the direct URL
  for ordinary runtime traffic.
- Set both variables through the deployment's secret/environment manager.
  `.env.example` contains placeholders only. Never commit actual URLs,
  passwords, or copied connection strings.
- Use a separate, least-privilege migration identity if the deployment and
  Neon role setup support it. Runtime credentials should not have schema
  modification privileges. Restrict and rotate both credentials.

## Integrity migration

`prisma/migrations/20261104223000_add_integrity_constraints/migration.sql`
adds checks for nonnegative product prices, stock, order fees and totals;
positive order-item quantities; nonnegative item prices/subtotals; line-item
arithmetic; and `Order.total = subtotal + deliveryFee`. Deferred constraint
triggers enforce that an order subtotal equals the sum of its item subtotals
at transaction commit, allowing an order and its items to be written in one
transaction.

Prisma schema syntax does not represent these PostgreSQL checks and triggers.
They are therefore hand-maintained SQL in the additive migration and are not
shown by a schema-only generated SQL diff. Preserve them in future migration
work and verify them from migration history when access is separately
authorized. The migration is not idempotent and should be applied only once
through the reviewed migration process. It is designed for an empty new
database; on a populated database, existing values must be checked and
reconciled before the constraints are added.

## Backup strategy and verification

Before production use, an owner must verify the Neon project's backup/PITR
features, retention window, recovery-point objective, and restore procedure
against the selected plan. Record the verified settings and test a restore to
an isolated branch or project. If an independent logical backup is required,
schedule encrypted `pg_dump` exports to access-controlled storage, retain them
according to policy, and regularly test `pg_restore`. Do not treat an
unverified dashboard setting or an untested dump as a usable backup.

No backup or restore point is asserted to exist by this repository.

## Restore procedure

1. Declare the incident, stop or restrict writes, and record the affected
   project, branch, time window, and desired recovery point.
2. Select a verified Neon point-in-time restore or a verified logical backup
   that meets the recovery objective. Restore to a new isolated branch/project
   where possible; preserve the affected database for investigation.
3. Keep application traffic disabled. Use only a separately authorized
   operator and the direct migration endpoint for schema inspection or
   recovery work.
4. Compare the restored schema and data with the committed migration history.
   Do not reset the database or blindly replay migrations.
5. Run the verification checklist below. Obtain application/data-owner
   approval before changing traffic to the restored target.
6. Preserve incident notes and the original source until the restore has been
   accepted and retention requirements are met.

## Migration failure and recovery

- Stop deployment on any migration error. Preserve logs and the migration
  error; do not retry repeatedly or run `db push`.
- Determine whether the migration committed fully, partially, or not at all
  using an authorized inspection of the database's Prisma migration history
  and actual schema. `prisma migrate status` is not an offline check: it
  connects to the configured database. Do not run it until connection
  approval is explicitly granted.
- Do not edit an already-applied migration. If an unapplied migration needs
  correction, review the SQL and produce a new deployment artifact before
  retrying. If a migration partially applied, reconcile the actual schema
  under a reviewed recovery procedure before deciding whether to mark it
  resolved or roll forward.
- Prefer a new forward-only corrective migration for changes already applied
  in production. Avoid destructive rollback. Restore from backup only when
  forward repair is unsafe and the data-loss window is accepted by the owner.
- For the integrity migration, inspect any constraint violation and correct
  invalid data deliberately; do not drop or bypass constraints as a shortcut.

## Verification after restore or migration

- Confirm the target project, branch, and database using approved metadata
  without disclosing connection strings.
- Compare applied migration history with the reviewed migration files.
- Verify expected tables, indexes, foreign keys, checks, and integrity
  triggers are present.
- Check row counts and business-level totals against trusted pre-incident
  records; sample products, stock, customers, orders, and order items.
- In a controlled environment, verify order arithmetic, item quantity and
  stock constraints, and expected FK delete behavior.
- Run application health checks and read/write smoke tests with a
  least-privilege application role. Confirm errors are logged without
  returning secrets or connection details to clients.
- Keep the restored target isolated until database, application, and data
  owners accept the results.

## Admin security gate

The authentication endpoints use Argon2id hashes, opaque database-backed
sessions, HTTP-only session cookies, CSRF token cookies and origin checks,
role authorization middleware, and per-process login rate limiting. Admin
business operations still return `501` until their operation-specific role
checks and audit requirements are implemented. No public registration is
provided.

- `POST /api/admin/auth/login` accepts `email` and `password`; the response
  includes the safe admin identity and CSRF token.
- `GET /api/admin/auth/session` validates the session and CSRF cookie and
  returns the CSRF token for a page reload.
- `POST /api/admin/auth/logout` requires the exact allowed `Origin`, the
  session cookie, the CSRF cookie, and the same token in `X-CSRF-Token`.
- Browser clients hosted on an allowed origin must send requests with
  credentials included. Production cookies are `Secure`, `HttpOnly` for the
  session cookie, `SameSite=Strict`, and use the `__Host-` prefix over HTTPS.

Provision an initial OWNER interactively with `cd server && npm run
admin:provision`. The command requires `DIRECT_URL`, prompts for an email and
twice-entered password without echoing the password, and refuses duplicate
accounts. Do not execute it until the target and operator have been separately
authorized.

The default login limiter allows five attempts per source IP per 15 minutes
in each application process. It is not a shared/distributed rate-limit store;
production deployments with multiple instances should add a shared limiter
and configure trusted proxy handling deliberately before relying on IP-based
limits. Configure an exact production `FRONTEND_ORIGINS` allow-list and serve
the app only over HTTPS so production `__Host-` cookies are secure.

Keep database credentials and password hashes out of client responses and
logs. Add audit logging and review operation-specific authorization before
implementing or enabling admin business operations.
