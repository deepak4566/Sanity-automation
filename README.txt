QA Sanity Pipeline - Milestone 1
================================
Goal: after every successful QA deployment, GitHub Actions automatically runs the
Playwright @sanity suite, emails a PASS/FAIL report with failed-test details, and
blocks promotion to the next environment if a @critical scenario fails.

01-Design/        Design doc (Word): scope, flow, email options, setup, acceptance criteria, open questions
02-Starter-Code/  Copy into the app repo. Start with 02-Starter-Code/README.md
                  (full pipeline: .github/workflows/ci-cd.yml)
03-Sample-Email/  What the PASS and FAIL (promotion blocked) emails look like

Live, editable version of the design doc (comments welcome):
https://claude.ai/code/artifact/4b044957-ae2f-4bbf-aa42-672dbee380f4
(Share access from the doc first if teammates can't open it.)

Owner: Abhijeet Waghmare
