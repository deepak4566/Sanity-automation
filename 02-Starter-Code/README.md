# Post-Deploy QA Sanity Pipeline (Milestone 1)

After every deployment, GitHub Actions runs the Playwright `@sanity` suite against the
deployed URL and emails a PASS / FAIL report to a configurable list of people.

```
deploy job ──► post-deploy-sanity.yml ──► Playwright @sanity ──► build-report.mjs ──► SMTP email
                                              │                                         + job summary
                                              └─► HTML report / traces uploaded as run artifact
```

## Files

| Path | Purpose |
|---|---|
| `.github/workflows/post-deploy-sanity.yml` | Reusable sanity workflow (`workflow_call` + manual `workflow_dispatch`) |
| `.github/workflows/deploy.example.yml` | Shows the 6-line `sanity` job to add to your deploy workflow |
| `playwright.config.ts` | HTML + JSON reporters, 1 retry in CI, traces/screenshots on failure |
| `tests/sanity/smoke.spec.ts` | Starter sanity tests — replace with real checks, tag each with `@sanity` |
| `scripts/build-report.mjs` | Turns Playwright JSON into email subject + HTML body + job summary |

## Setup (≈30 min)

1. Copy these files into your app repo (or a dedicated QA repo — see note below). Run `npm install` and commit `package-lock.json` (the workflow uses `npm ci`).
2. **GitHub → Settings → Environments**: create `dev`, `qa`, `staging`, `prod` (whichever you deploy to). In each, add variable `BASE_URL`.
3. **Settings → Secrets and variables → Actions**
   - Secrets: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` (+ optional `SANITY_USER`, `SANITY_PASSWORD` for the login test)
   - Variables: `SANITY_EMAIL_RECIPIENTS` = `qa@culinarydigital.com,lead@culinarydigital.com` (comma-separated), optional `SANITY_EMAIL_FROM`
   - Recipients can also be set per environment (e.g. a wider list for `prod`).
4. Add the `sanity` job from `deploy.example.yml` to your deploy workflow (`needs: deploy`, `secrets: inherit`).
5. Test it: Actions → **Post-Deploy Sanity** → *Run workflow* → pick `qa`.

### SMTP options (any of these works with the same 4 secrets)

| Provider | SMTP_SERVER | SMTP_PORT | Username / password |
|---|---|---|---|
| Microsoft 365 | `smtp.office365.com` | 587 | Mailbox + password (SMTP AUTH must be enabled for that mailbox) |
| Google Workspace | `smtp.gmail.com` | 465 | Account + App Password |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` / API key |
| AWS SES | `email-smtp.<region>.amazonaws.com` | 587 | SES SMTP credentials |

## Behaviour

- Subject: `✅ [Sanity PASS] QA — 12/12 passed (a1b2c3d)` or `❌ [Sanity FAIL] PROD — 10/12 passed, 2 failed (a1b2c3d)`
- `⚠️ ERROR` status when no results were produced (suite crashed, bad config, app unreachable).
- The sanity job fails (red) on FAIL/ERROR, so the deploy run shows the problem too.
- Email is sent on every run, pass or fail. Full HTML report, traces, screenshots and videos are in the run's artifacts (14 days).

## Notes

- **Tests in a separate QA repo?** Put this workflow in the QA repo with a `repository_dispatch` trigger and have the deploy workflow call it via `gh api repos/<org>/<qa-repo>/dispatches`. Ask and we'll add it in Milestone 2.
- **No changes to deploy workflow allowed?** Uncomment the `workflow_run` trigger in `post-deploy-sanity.yml` (and don't add the `sanity` job).
- Keep the `@sanity` set fast (< 5 min): it runs on every deploy.

## Run locally

```bash
npm install && npx playwright install chromium
BASE_URL=https://qa.example.com npm run sanity
TARGET_ENV=qa BASE_URL=https://qa.example.com npm run report:email   # writes email-body.html
```
