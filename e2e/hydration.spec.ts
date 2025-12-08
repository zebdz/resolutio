import { test, expect } from '@playwright/test';

test.describe('Hydration', () => {
  test('should not have hydration errors on register page', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any hydration errors to appear
    await page.waitForTimeout(1000);
    
    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(err => 
      err.includes('Hydration') || 
      err.includes('hydration') ||
      err.includes("didn't match")
    );
    
    expect(hydrationErrors, `Found hydration errors: ${hydrationErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `Found page errors: ${pageErrors.map(e => e.message).join('\n')}`).toHaveLength(0);
  });

  test('html lang attribute should be consistent (en)', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Check that lang is "en" not "register" or other pathname
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    
    // Verify it's a valid locale
    const lang = await page.locator('html').getAttribute('lang');
    expect(['en', 'ru']).toContain(lang);
  });

  test('html lang attribute should be consistent (ru)', async ({ page, context }) => {
    await context.addCookies([{
      name: 'NEXT_LOCALE',
      value: 'ru',
      domain: 'localhost',
      path: '/',
    }]);
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Check that lang is "ru" not "register" or other pathname
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('should not have hydration errors on landing page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const hydrationErrors = consoleErrors.filter(err => 
      err.includes('Hydration') || 
      err.includes('hydration') ||
      err.includes("didn't match")
    );
    
    expect(hydrationErrors).toHaveLength(0);
  });
});
