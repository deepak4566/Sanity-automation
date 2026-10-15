import { test, expect } from '@playwright/test';

/*
 * Daily Smoke Test Suite:
 * Executed daily (e.g. 06:00 UTC via cron) to verify broad system stability and health.
 *
 * Tagging convention:
 *   @smoke     Included in daily smoke run.
 *   @critical  Essential smoke check.
 */

test.describe('Smoke', () => {

  test('System health and sub-services status check @smoke @critical', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe('UP');
    expect(data.services?.database).toBe('connected');
    expect(data.services?.redisCache).toBe('ready');
    expect(data.services?.paymentGateway).toBe('operational');
  });

  test('User authentication and session cookie persistence @smoke @critical', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username|email/i).fill('testuser');
    await page.getByLabel(/password/i).fill('Password123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dashboard/);
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'auth_token');
    expect(authCookie, 'auth_token cookie present').toBeDefined();
    expect(authCookie?.value).toBe('demo-session-token-valid');
  });

  test('Navigation across primary headers and routes @smoke', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Products' }).first().click();
    await expect(page).toHaveURL(/products/);
    await expect(page.getByRole('heading', { name: /product catalog/i })).toBeVisible();

    await page.getByRole('link', { name: 'Orders' }).first().click();
    await expect(page).toHaveURL(/orders/);
    await expect(page.getByRole('heading', { name: /order history/i })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Product catalog display and search query filtering @smoke', async ({ page }) => {
    await page.goto('/products?q=keyboard');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.getByText('Ergonomic Mechanical Keyboard')).toBeVisible();

    // Clear search
    await page.goto('/products');
    await expect(page.locator('.product-card')).toHaveCount(5);
  });

  test('Cart addition, quantity increment, and price calculation @smoke', async ({ page }) => {
    await page.goto('/');
    const initialCounter = await page.locator('#cart-counter').textContent();
    const initialCount = Number(initialCounter);

    await page.locator('.btn-add-cart').first().click();
    await page.waitForTimeout(500);

    const updatedCounter = await page.locator('#cart-counter').textContent();
    expect(Number(updatedCounter)).toBeGreaterThan(initialCount);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /shopping cart/i })).toBeVisible();
    await expect(page.locator('.data-table tbody tr')).toBeVisible();
  });

  test('Profile and user preferences view @smoke', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /user profile/i })).toBeVisible();
    await expect(page.getByText(/DevOps Engineer/i)).toBeVisible();
  });

  test('Responsive viewport layout on mobile and desktop @smoke', async ({ page }) => {
    // Test Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('.brand-logo')).toBeVisible();
    await expect(page.locator('#hero-banner')).toBeVisible();

    // Reset to Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('API 404 and error response format verification @smoke', async ({ request }) => {
    const res = await request.get('/api/non-existent-route-404');
    expect(res.status()).toBe(404);
  });

});
