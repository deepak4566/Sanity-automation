#!/usr/bin/env node
// Reads Playwright's JSON report and produces:
//   email-body.html  - Responsive HTML email body matching company design
//   email-body.md    - Markdown for GitHub Step Summary ($GITHUB_STEP_SUMMARY)
//   GITHUB_OUTPUT    - status (PASS|FAIL|ERROR), gate (OPEN|BLOCKED), subject, counts
//
// Promotion Gate (GATE_MODE):
//   critical (default) - BLOCKED if any @critical test fails, or if no results are produced (ERROR)
//   any                - BLOCKED on any failed test
import fs from 'node:fs';

const file = process.argv[2] ?? 'results/results.json';
const env = process.env;
const suiteName = env.TEST_SUITE_NAME || 'Sanity';
const targetEnv = env.TARGET_ENV ?? 'qa';
const baseUrl = env.BASE_URL ?? 'http://localhost:3000';
const runUrl = env.RUN_URL ?? '';
const sha = (env.COMMIT_SHA ?? '').slice(0, 7);
const branch = env.BRANCH ?? '';
const actor = env.TRIGGERED_BY ?? '';
const gateMode = (env.GATE_MODE || 'critical').toLowerCase();
const unreachable = env.APP_REACHABLE === 'false';
const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ansi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

let report = null;
try {
  if (fs.existsSync(file)) {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    console.warn(`Report file ${file} does not exist.`);
  }
} catch (e) {
  console.error(`Could not read ${file}: ${e.message}`);
}

// Walk nested suites -> specs -> tests
const rows = [];
const walk = (suite, path = []) => {
  const p = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const last = t.results?.at(-1) ?? {};
      const tags = [...(spec.tags ?? []), ...(t.tags ?? [])].map((x) => String(x).replace(/^@/, ''));
      rows.push({
        name: [...p.filter((x) => !x.endsWith('.ts')), spec.title].join(' › ').replace(/\s*@\w+/g, '').trim(),
        file: spec.file ? spec.file.replace(/\\/g, '/') : '',
        critical: /@critical\b/.test(spec.title) || tags.includes('critical'),
        outcome: t.status, // expected | unexpected | flaky | skipped
        duration: (t.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0),
        error: ansi(last.error?.message ?? '').split('\n').slice(0, 6).join('\n'),
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, p);
};
for (const s of report?.suites ?? []) walk(s);

const count = (o) => rows.filter((r) => r.outcome === o).length;
const passed = count('expected');
const failed = count('unexpected');
const flaky = count('flaky');
const skipped = count('skipped');
const total = rows.length;
const globalErrors = report?.errors ?? [];
const durationSec = Math.round((report?.stats?.duration ?? 0) / 1000);
const failures = rows.filter((r) => r.outcome === 'unexpected');
const criticalFailures = failures.filter((r) => r.critical);

let status;
if (!report || total === 0 || globalErrors.length) status = 'ERROR';
else status = failed > 0 ? 'FAIL' : 'PASS';

const blocked = status === 'ERROR' || (gateMode === 'any' ? failed > 0 : criticalFailures.length > 0);
const gate = blocked ? 'BLOCKED' : 'OPEN';

const icon = { PASS: '✅', FAIL: '❌', ERROR: '⚠️' }[status];
const color = { PASS: '#1a7f37', FAIL: '#cf222e', ERROR: '#9a6700' }[status];
const subject =
  `${icon} [${suiteName} ${status}] ${targetEnv.toUpperCase()} — ` +
  (status === 'ERROR' ? 'no results produced' : `${passed + flaky}/${total - skipped} passed${failed ? `, ${failed} failed` : ''}`) +
  (sha ? ` (${sha})` : '') +
  (blocked ? ' — PROMOTION BLOCKED' : '');

const gateText = blocked
  ? status === 'ERROR'
    ? 'BLOCKED — no test results were produced; review before promoting.'
    : `BLOCKED — ${gateMode === 'any' ? failed : criticalFailures.length} ${gateMode === 'any' ? '' : 'critical '}test(s) failed; review before promoting to the next environment.`
  : failed
    ? 'ALLOWED — only non-critical tests failed; please review.'
    : 'ALLOWED — safe to promote to the next environment.';
const gateColor = blocked ? '#cf222e' : failed ? '#9a6700' : '#1a7f37';

const badge = (r) => (r.critical ? ' <span style="background:#cf222e;color:#fff;border-radius:3px;padding:1px 5px;font-size:11px">CRITICAL</span>' : '');
const failRowsHtml = failures
  .map((r) => `<tr><td style="padding:6px;border:1px solid #ddd">${esc(r.name)}${badge(r)}<br><small style="color:#666">${esc(r.file)}</small></td><td style="padding:6px;border:1px solid #ddd"><pre style="margin:0;white-space:pre-wrap;font-size:12px">${esc(r.error)}</pre></td></tr>`)
  .join('');
const allRowsHtml = rows
  .map((r) => {
    const label = { expected: 'PASS', unexpected: 'FAIL', flaky: 'FLAKY', skipped: 'SKIP' }[r.outcome] ?? r.outcome;
    const c = { PASS: '#1a7f37', FAIL: '#cf222e', FLAKY: '#9a6700', SKIP: '#666' }[label];
    return `<tr><td style="padding:4px 6px;border:1px solid #eee">${esc(r.name)}${badge(r)}</td><td style="padding:4px 6px;border:1px solid #eee;color:${c};font-weight:600">${label}</td><td style="padding:4px 6px;border:1px solid #eee;text-align:right">${(r.duration / 1000).toFixed(1)}s</td></tr>`;
  })
  .join('');

const html = `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;color:#222;max-width:760px">
<div style="background:${color};color:#fff;padding:14px 18px;border-radius:6px">
  <div style="font-size:20px;font-weight:700">${icon} ${esc(suiteName)} ${status} — ${esc(targetEnv.toUpperCase())}</div>
  <div style="font-size:13px;opacity:.9">${esc(when)}</div>
</div>
<div style="margin:12px 0;padding:10px 14px;border-left:5px solid ${gateColor};background:#f6f8fa;font-size:14px"><b>Promotion gate:</b> <span style="color:${gateColor};font-weight:700">${esc(gateText)}</span></div>
<table style="margin:14px 0;border-collapse:collapse;font-size:14px">
  <tr><td style="padding:3px 12px 3px 0;color:#666">Environment</td><td>${esc(targetEnv)}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">URL</td><td><a href="${esc(baseUrl)}">${esc(baseUrl)}</a>${unreachable ? ' <b style="color:#cf222e">(not reachable after wait)</b>' : ''}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Branch / commit</td><td>${esc(branch || 'main')} ${esc(sha || 'local')}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Triggered by</td><td>${esc(actor || 'automation')}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Result</td><td><b>${passed} passed</b>, <b style="color:#cf222e">${failed} failed</b> (${criticalFailures.length} critical), ${flaky} flaky, ${skipped} skipped — ${total} total in ${durationSec}s</td></tr>
</table>
${globalErrors.length ? `<p style="color:#9a6700"><b>Suite error:</b></p><pre style="white-space:pre-wrap">${esc(ansi(globalErrors.map((e) => e.message).join('\n')))}</pre>` : ''}
${!report ? '<p style="color:#9a6700"><b>No test results were produced.</b> The suite may have crashed before running — check the run log.</p>' : ''}
${failures.length ? `<h3 style="color:#cf222e">Failed tests</h3><table style="border-collapse:collapse;font-size:13px;width:100%">${failRowsHtml}</table>` : ''}
${rows.length ? `<h3>All tests</h3><table style="border-collapse:collapse;font-size:13px;width:100%">${allRowsHtml}</table>` : ''}
<p style="margin-top:18px"><a href="${esc(runUrl || '#')}" style="background:#24292f;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open run &amp; download full HTML report</a></p>
<p style="font-size:12px;color:#888">Automated post-deployment verification. Traces, screenshots and videos for failures are in the run artifacts.</p>
</body></html>`;

const md = [
  `## ${icon} ${suiteName} ${status} — ${targetEnv.toUpperCase()}`,
  '',
  `**Promotion Gate:** ${gateText}`,
  '',
  `| Passed | Failed | Critical Failed | Flaky | Skipped | Total | Duration |`,
  `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|`,
  `| ${passed} | ${failed} | ${criticalFailures.length} | ${flaky} | ${skipped} | ${total} | ${durationSec}s |`,
  '',
  ...(failures.length
    ? ['### Failed Tests', ...failures.map((f) => `- ${f.critical ? '🔴 **[CRITICAL]** ' : '⚠️ '}**${f.name}** — \`${f.error.split('\n')[0]}\``), '']
    : []),
  `> **Target URL:** ${baseUrl} | **Commit:** \`${sha || 'HEAD'}\` | **Triggered by:** ${actor || 'CI/CD'}`
].join('\n');

fs.writeFileSync('email-body.html', html);
fs.writeFileSync('email-body.md', md);

const out = [
  `status=${status}`,
  `gate=${gate}`,
  `subject=${subject}`,
  `passed=${passed}`,
  `failed=${failed}`,
  `critical_failed=${criticalFailures.length}`,
  `total=${total}`,
  `suite_name=${suiteName}`
].join('\n') + '\n';

if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, out);
console.log(out);
