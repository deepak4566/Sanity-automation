#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';

const rawMode = process.argv[2] || 'fail';
const mode = rawMode === 'fail' || rawMode === 'critical' ? 'critical_checkout' : rawMode;

console.log(`\n================================================================`);
console.log(`🚀 [DEMO GATE SIMULATION] Running Sanity Suite with mode: ${mode.toUpperCase()}`);
console.log(`================================================================\n`);

const env = {
  ...process.env,
  SIMULATE_FAILURE: mode,
  TARGET_ENV: 'qa',
  CI: 'true'
};

const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js');

console.log(`1. Executing Playwright Sanity suite...`);
spawnSync('node', [playwrightCli, 'test', '--grep', '@sanity'], {
  env,
  stdio: 'inherit'
});

console.log(`\n2. Generating report and evaluating promotion gate...`);
spawnSync('node', ['scripts/build-report.mjs', 'results/results.json'], {
  env,
  stdio: 'inherit'
});

console.log(`\n================================================================`);
if (mode.includes('critical')) {
  console.log(`🛡️ PROMOTION GATE STATUS: BLOCKED`);
  console.log(`A @critical scenario failed. In GitHub Actions, the pipeline`);
  console.log(`terminates with error code 1, BLOCKING deploy-staging.`);
} else {
  console.log(`✅ PROMOTION GATE STATUS: OPEN (Safe to promote)`);
}
console.log(`================================================================\n`);
