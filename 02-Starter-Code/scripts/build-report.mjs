#!/usr/bin/env node
// Reads Playwright's JSON report and produces:
//   email-body.html  - HTML email body
//   email-body.md    - Markdown for the GitHub job summary
//   GITHUB_OUTPUT    - status (PASS|FAIL|ERROR), subject, counts
import fs from 'node:fs';

const file = process.argv[2] ?? 'results/results.json';
const env = process.env;
const targetEnv = env.TARGET_ENV ?? 'unknown';
const baseUrl = env.BASE_URL ?? '';
const runUrl = env.RUN_URL ?? '';
const sha = (env.COMMIT_SHA ?? '').slice(0, 7);
const branch = env.BRANCH ?? '';
const actor = env.TRIGGERED_BY ?? '';
const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let report = null;
try {
  report = JSON.parse(fs.readFileSync(file, 'utf8'));
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
      const outcome = t.status; // expected | unexpected | flaky | skipped
      rows.push({
        name: [...p.filter((x) => !x.endsWith('.ts')), spec.title].join(' › '),
        file: spec.file,
        outcome,
        duration: (t.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0),
        error: (last.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 4).join('\n'),
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

let status;
if (!report || total === 0 || globalErrors.length) status = 'ERROR';
else status = failed > 0 ? 'FAIL' : 'PASS';

const icon = { PASS: '✅', FAIL: '❌', ERROR: '⚠️' }[status];
const color = { PASS: '#1a7f37', FAIL: '#cf222e', ERROR: '#9a6700' }[status];
const subject = `${icon} [Sanity ${status}] ${targetEnv.toUpperCase()} — ${passed}/${total} passed${failed ? `, ${failed} failed` : ''}${sha ? ` (${sha})` : ''}`;

const failures = rows.filter((r) => r.outcome === 'unexpected');
const failRowsHtml = failures
  .map((r) => `<tr><td style="padding:6px;border:1px solid #ddd">${esc(r.name)}<br><small style="color:#666">${esc(r.file)}</small></td><td style="padding:6px;border:1px solid #ddd"><pre style="margin:0;white-space:pre-wrap;font-size:12px">${esc(r.error)}</pre></td></tr>`)
  .join('');
const allRowsHtml = rows
  .map((r) => {
    const label = { expected: 'PASS', unexpected: 'FAIL', flaky: 'FLAKY', skipped: 'SKIP' }[r.outcome] ?? r.outcome;
    const c = { PASS: '#1a7f37', FAIL: '#cf222e', FLAKY: '#9a6700', SKIP: '#666' }[label];
    return `<tr><td style="padding:4px 6px;border:1px solid #eee">${esc(r.name)}</td><td style="padding:4px 6px;border:1px solid #eee;color:${c};font-weight:600">${label}</td><td style="padding:4px 6px;border:1px solid #eee;text-align:right">${(r.duration / 1000).toFixed(1)}s</td></tr>`;
  })
  .join('');

const html = `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;color:#222;max-width:760px">
<div style="background:${color};color:#fff;padding:14px 18px;border-radius:6px">
  <div style="font-size:20px;font-weight:700">${icon} Sanity ${status} — ${esc(targetEnv.toUpperCase())}</div>
  <div style="font-size:13px;opacity:.9">${esc(when)}</div>
</div>
<table style="margin:14px 0;border-collapse:collapse;font-size:14px">
  <tr><td style="padding:3px 12px 3px 0;color:#666">Environment</td><td>${esc(targetEnv)}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">URL</td><td><a href="${esc(baseUrl)}">${esc(baseUrl)}</a></td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Branch / commit</td><td>${esc(branch)} ${esc(sha)}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Triggered by</td><td>${esc(actor)}</td></tr>
  <tr><td style="padding:3px 12px 3px 0;color:#666">Result</td><td><b>${passed} passed</b>, <b style="color:#cf222e">${failed} failed</b>, ${flaky} flaky, ${skipped} skipped — ${total} total in ${durationSec}s</td></tr>
</table>
${globalErrors.length ? `<p style="color:#9a6700"><b>Suite error:</b></p><pre style="white-space:pre-wrap">${esc(globalErrors.map((e) => e.message).join('\n').replace(/\u001b\[[0-9;]*m/g, ''))}</pre>` : ''}
${!report ? '<p style="color:#9a6700"><b>No test results were produced.</b> The suite may have crashed before running — check the run log.</p>' : ''}
${failures.length ? `<h3 style="color:#cf222e">Failed tests</h3><table style="border-collapse:collapse;font-size:13px;width:100%">${failRowsHtml}</table>` : ''}
${rows.length ? `<h3>All tests</h3><table style="border-collapse:collapse;font-size:13px;width:100%">${allRowsHtml}</table>` : ''}
<p style="margin-top:18px"><a href="${esc(runUrl)}" style="background:#24292f;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open run &amp; download full HTML report</a></p>
<p style="font-size:12px;color:#888">Automated post-deployment sanity check. Traces, screenshots and videos for failures are in the run's artifacts.</p>
</body></html>`;

const md = [
  `## ${icon} Sanity ${status} — ${targetEnv}`,
  '',
  `| Passed | Failed | Flaky | Skipped | Total | Duration |`,
  `|---|---|---|---|---|---|`,
  `| ${passed} | ${failed} | ${flaky} | ${skipped} | ${total} | ${durationSec}s |`,
  '',
  ...(failures.length ? ['### Failed tests', ...failures.map((f) => `- **${f.name}** — ${f.error.split('\n')[0]}`)] : []),
].join('\n');

fs.writeFileSync('email-body.html', html);
fs.writeFileSync('email-body.md', md);

const out = [`status=${status}`, `subject=${subject}`, `passed=${passed}`, `failed=${failed}`, `total=${total}`].join('\n') + '\n';
if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, out);
console.log(out);
