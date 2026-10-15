# Post-Deploy QA Sanity Pipeline

Every successful deployment to QA automatically runs the Playwright `@sanity` suite, emails a
PASS/FAIL report (with failed-test details) and **blocks promotion to the next environment if a
critical scenario fails**.

```
build ─► deploy-qa ─► sanity-qa ──[gate]──► deploy-staging ─► sanity-staging ──[gate]──► deploy-prod
                         │                                                        (+ optional approval)
                         ├─► Playwright @sanity ─► build-report.mjs ─► email (PASS and FAIL) + job summary
                         └─► HTML report / traces / screenshots / video as run artifact
```

## Files

| Path | Purpose |
|---|---|
| `.github/workflows/ci-cd.yml` | **Full pipeline**: build → QA → sanity → staging → sanity → prod. Replace the `TODO` steps with your real build/deploy. |
| `.github/workflows/post-deploy-sanity.yml` | Reusable sanity workflow: runs tests, emails report, enforces the gate. Also runnable manually. |
| `.github/workflows/deploy.example.yml` | Example of hooking sanity into an *existing* deploy workflow instead of using `ci-cd.yml` |
| `.github/workflows/qa-sanity-on-deploy.yml` | Optional zero-touch trigger (`workflow_run`) if the deploy workflow can't be edited |
| `playwright.config.ts` | HTML + JSON reporters, 1 retry in CI, trace/screenshot/video on failure |
| `tests/sanity/smoke.spec.ts` | Starter checks. Convert your manual sanity scenarios into tests like these |
| `scripts/build-report.mjs` | Playwright JSON → email subject, HTML body, job summary, gate decision |

## How the promotion gate works

- Tag every sanity test `@sanity`. Tag the ones that must never break `@sanity @critical` (in the test title).
- **Any failed `@critical` test, or no results at all (app down / suite crashed), makes the sanity job fail.**
  Because the next deploy job has `needs: sanity-…`, it does not run. The email says **PROMOTION BLOCKED**.
- Failures in tests tagged only `@sanity` are reported in the email and as a warning, but do **not** block.
  To block on *any* failure, set repo variable `SANITY_GATE_MODE` = `any`.
- To release a block: review the report, fix the issue, then re-run (Actions → *Re-run failed jobs*) or push a fix.
- For an additional human approval, add **Required reviewers** to the `staging` / `prod` environments.

## Setup (≈30 min)

1. Copy these files into the app repo (or a dedicated QA repo, see notes). Run `npm install`, commit `package-lock.json` (the workflow uses `npm ci`).
2. **Settings → Environments**: create `qa`, `staging`, `prod` (and `dev` if used). In each add variable `BASE_URL`. Optionally `HEALTH_PATH` (e.g. `/api/health`).
3. **Settings → Secrets and variables → Actions**
   - Secrets: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` (+ `SANITY_USER`, `SANITY_PASSWORD` for the login test; can be set per environment)
   - Variables: `SANITY_EMAIL_RECIPIENTS` (comma-separated), optional `SANITY_EMAIL_FROM`
   - Optional variables: `SANITY_RUNNER` (self-hosted runner label; default `ubuntu-latest`), `SANITY_GATE_MODE` (`critical` | `any`)
   - Recipients can be overridden per environment (e.g. a wider list for `prod`).
4. Fill in the build/deploy steps in `ci-cd.yml` (or add the `sanity` job from `deploy.example.yml` to your existing workflow).
5. Replace the starter tests with your real scenarios.
6. Test it: Actions → **Post-Deploy Sanity** → *Run workflow* → `qa`.

### SMTP options (same 4 secrets for any provider)

| Provider | SMTP_SERVER | SMTP_PORT | Username / password |
|---|---|---|---|
| Microsoft 365 | `smtp.office365.com` | 587 | Mailbox + password (SMTP AUTH must be enabled for that mailbox) |
| Google Workspace | `smtp.gmail.com` | 465 | Account + App Password |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` / API key |
| AWS SES | `email-smtp.<region>.amazonaws.com` | 587 | SES SMTP credentials |

## Behaviour

- Subject: `✅ [Sanity PASS] QA — 10/10 passed (abcdef1)`, `❌ [Sanity FAIL] QA — 8/10 passed, 2 failed (abcdef1) — PROMOTION BLOCKED`, or `⚠️ [Sanity ERROR] QA — no results produced (abcdef1) — PROMOTION BLOCKED`.
- The email is sent on **every** run, pass or fail, and lists each failed test with its error, flags critical tests, and shows the gate decision.
- If the app isn't reachable, the workflow waits up to 5 min, then still runs so you get a FAIL/ERROR email instead of silence.
- Full HTML report, traces, screenshots and videos are in the run's artifacts (14 days).

## Notes

- **Tests in a separate QA repo?** Put the sanity workflow there with a `repository_dispatch` trigger and call it from the deploy workflow.
- **Can't edit the deploy workflow?** Use `qa-sanity-on-deploy.yml`. It alerts but cannot stop that workflow's own promotion.
- Keep the `@sanity` set under 5 min: it runs on every deploy.
- `ignoreHTTPSErrors` is `true` in `playwright.config.ts` for internal certs; set it to `false` if yours are valid.

## Run locally

```bash
npm install && npx playwright install chromium
BASE_URL=https://qa.example.com npm run sanity
TARGET_ENV=qa BASE_URL=https://qa.example.com npm run report:email   # writes email-body.html
```
