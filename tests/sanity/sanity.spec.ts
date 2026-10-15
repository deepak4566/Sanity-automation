import { test, expect } from '@playwright/test';

/*
 * Post-Deploy QA Sanity Test Suite:
 * Executed automatically after every successful deployment to QA (and Staging/Prod).
 *
 * Tagging convention:
 *   @sanity    Included in the post-deploy sanity run (aim to keep full suite < 2-3 mins).
 *   @critical  Mission-critical scenario that MUST pass. Any failure here BLOCKS promotion
 *              to the next environment (gate = BLOCKED).
 *   (Tests tagged only @sanity will report a warning if they fail, but do not block promotion
 *   unless SANITY_GATE_MODE=any is explicitly enabled).
 */

test.describe('Sanity', () => {

  test('Home page loads without server errors @sanity @critical', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'No response received from home page').not.toBeNull();
    expect(response!.status(), 'Home page returned error HTTP status').toBeLessThan(400);
    await expect(page).toHaveTitle(/ShopNova/i);
    await expect(page.locator('#hero-banner')).toBeVisible();
  });

  test('Health endpoint is OK @sanity @critical', async ({ request }) => {
    const healthPath = process.env.HEALTH_PATH || '/api/health';
    const res = await request.get(healthPath);
    expect(res.status(), `GET ${healthPath} status`).toBe(200);
    
    const body = await res.json();
    expect(body.status, 'Health status property').toBe('UP');
    expect(body.services?.database, 'Database health check').toBe('connected');
  });

  test('User can log in @sanity @critical', async ({ page }) => {
    const username = process.env.SANITY_USER || 'testuser';
    const password = process.env.SANITY_PASSWORD || 'Password123!';

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    await page.getByLabel(/username|email/i).fill(username);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Verify successful authentication and redirection to dashboard
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('Search returns results @sanity @critical', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('laptop');
    await page.getByRole('button', { name: /search/i }).click();

    // Verify search results grid displays matching items
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.getByText(/Cloud Laptop Pro 16/i)).toBeVisible();
  });

  test('Add item to cart @sanity @critical', async ({ page }) => {
    await page.goto('/');
    const addBtn = page.locator('.btn-add-cart').first();
    await addBtn.click();

    // Verify cart badge increments and toast appears
    const cartCounter = page.locator('#cart-counter');
    await expect(cartCounter).toBeVisible();
    const count = await cartCounter.textContent();
    expect(Number(count)).toBeGreaterThan(0);
  });

  test('Checkout page opens @sanity @critical', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.locator('#checkout-form')).toBeVisible();
    await expect(page.locator('#btn-place-order')).toBeVisible();
  });

  test('Order history loads @sanity', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: /order history/i })).toBeVisible();
    await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
  });

  test('Profile page loads @sanity', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /user profile/i })).toBeVisible();
    await expect(page.getByText(/Username:/i)).toBeVisible();
  });

  test('Static assets served @sanity', async ({ request }) => {
    const cssRes = await request.get('/assets/css/styles.css');
    expect(cssRes.status(), 'styles.css HTTP status').toBe(200);

    const jsRes = await request.get('/assets/js/app.js');
    expect(jsRes.status(), 'app.js HTTP status').toBe(200);
  });

  test('No console errors on home page @sanity', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors, `Uncaught console or page errors detected:\n${errors.join('\n')}`).toHaveLength(0);
  });

});
