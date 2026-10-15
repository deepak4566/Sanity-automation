import { test, expect } from '@playwright/test';

/*
 * Starter sanity checks: convert your manual sanity scenarios into tests like these.
 *
 *   @sanity    every test that belongs in the post-deploy suite (keep whole suite < 5 min)
 *   @critical  scenarios that MUST pass. A failure here BLOCKS promotion to the next environment.
 *              Tests tagged only @sanity are reported in the email but do not block.
 *
 * Put the tags in the test title.
 */

test.describe('Sanity', () => {
  test('home page loads without server errors @sanity @critical', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'no response from home page').not.toBeNull();
    expect(response!.status(), 'home page HTTP status').toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test('health endpoint is OK @sanity @critical', async ({ request }) => {
    // TODO: set HEALTH_PATH (repo/environment variable or here), e.g. /api/health or /actuator/health
    const healthPath = process.env.HEALTH_PATH ?? '/';
    const res = await request.get(healthPath);
    expect(res.ok(), `GET ${healthPath} -> ${res.status()}`).toBeTruthy();
  });

  test('user can log in @sanity @critical', async ({ page }) => {
    test.skip(!process.env.SANITY_USER, 'SANITY_USER secret not configured');
    // TODO: adjust route and selectors to your login page
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill(process.env.SANITY_USER!);
    await page.getByLabel(/password/i).fill(process.env.SANITY_PASSWORD!);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
    await expect(page).not.toHaveURL(/login/);
  });

  test('no console errors on home page @sanity', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
