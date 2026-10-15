import { test, expect } from '@playwright/test';

// Starter sanity checks. Replace selectors / paths with your app's real ones.
// Keep the whole @sanity suite under ~5 minutes: it gates every deployment.

test.describe('Sanity @sanity', () => {
  test('home page loads without server errors @sanity', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'no response from home page').not.toBeNull();
    expect(response!.status(), 'home page HTTP status').toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test('no console errors on home page @sanity', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('health endpoint is OK @sanity', async ({ request }) => {
    // TODO: change to your API health route, e.g. /api/health or /actuator/health
    const healthPath = process.env.HEALTH_PATH ?? '/';
    const res = await request.get(healthPath);
    expect(res.ok(), `GET ${healthPath} -> ${res.status()}`).toBeTruthy();
  });

  test('user can log in @sanity', async ({ page }) => {
    test.skip(!process.env.SANITY_USER, 'SANITY_USER secret not configured');
    // TODO: adjust route and selectors to your login page
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill(process.env.SANITY_USER!);
    await page.getByLabel(/password/i).fill(process.env.SANITY_PASSWORD!);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
    await expect(page).not.toHaveURL(/login/);
  });
});
