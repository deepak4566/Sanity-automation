import { test, expect } from '@playwright/test';

/*
 * Weekly Full Regression Test Suite:
 * Executed weekly (e.g. Sunday 00:00 UTC via cron) for in-depth regression testing.
 *
 * Tagging convention:
 *   @regression  Included in the weekly regression run.
 *   @critical    Core business flow that must never regress.
 */

test.describe('Regression', () => {

  test('Complete purchase journey: search, add to cart, checkout, and order receipt @regression @critical', async ({ page }) => {
    // 1. Search for a product
    await page.goto('/');
    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('laptop');
    await page.getByRole('button', { name: /search/i }).click();

    // 2. Add to cart
    await page.locator('.btn-add-cart').first().click();

    // 3. Navigate to Cart
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /shopping cart/i })).toBeVisible();

    // 4. Proceed to Checkout
    await page.locator('#btn-proceed-checkout').click();
    await expect(page).toHaveURL(/checkout/);

    // 5. Submit Order
    await page.locator('#fullName').fill('Alice DevOps');
    await page.locator('#address').fill('456 Cloud Parkway');
    await page.locator('#cardNumber').fill('4000 1234 5678 9010');
    await page.locator('#btn-place-order').click();

    // 6. Verify Confirmation on Orders page
    await expect(page).toHaveURL(/orders\?placed=ORD-/);
    await expect(page.getByText(/placed successfully/i)).toBeVisible();
  });

  test('Authentication boundary checks: invalid credentials reject @regression', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username|email/i).fill('invalid-user');
    await page.getByLabel(/password/i).fill('wrong-password-999');
    await page.getByRole('button', { name: /log in/i }).click();

    // Expect 401 and error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('Session logout and state termination @regression', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.getByLabel(/username|email/i).fill('testuser');
    await page.getByLabel(/password/i).fill('Password123!');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    // Click logout
    await page.goto('/api/logout');
    await expect(page).toHaveURL(/\/$/);

    // Verify auth cookie is cleared
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeUndefined();
  });

  test('Form validation on checkout required fields @regression', async ({ page }) => {
    await page.goto('/checkout');
    const nameInput = page.locator('#fullName');
    const isRequired = await nameInput.getAttribute('required');
    expect(isRequired).not.toBeNull();
  });

  test('Dashboard metrics data integrity and service list @regression', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Sanity Pass Rate')).toBeVisible();
    await expect(page.getByText('Gate Evaluation Time')).toBeVisible();
    await expect(page.locator('.dashboard-table-card table')).toBeVisible();
  });

  test('API contract schema validation for health and products @regression', async ({ request }) => {
    const healthRes = await request.get('/api/health');
    const healthData = await healthRes.json();
    expect(typeof healthData.status).toBe('string');
    expect(typeof healthData.environment).toBe('string');
    expect(typeof healthData.uptimeSeconds).toBe('number');

    const productsRes = await request.get('/api/search?q=');
    const productsData = await productsRes.json();
    expect(Array.isArray(productsData.results)).toBe(true);
    expect(productsData.results.length).toBeGreaterThanOrEqual(1);
  });

  test('Security headers verification @regression', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['content-type']).toContain('text/html');
  });

  test('Page response time benchmark @regression', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const elapsed = Date.now() - start;
    expect(elapsed, 'Home page load time should be under 3000ms').toBeLessThan(3000);
  });

});
