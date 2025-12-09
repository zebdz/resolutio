import { test, expect } from '@playwright/test';

test.describe('Locale Switching', () => {
  test('should switch language from EN to RU when clicking locale toggle', async ({
    page,
  }) => {
    // Navigate to register page
    await page.goto('/register');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check initial language is English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Check that English text is visible
    const heading = page.getByRole('heading', {
      name: /create account|создать аккаунт/i,
    });
    const headingText = await heading.textContent();
    expect(headingText).toContain('Create Account');

    // Find and click the locale switcher - it shows "RU" (the language you can switch to)
    const localeSwitcher = page.getByRole('link', {
      name: /switch to russian/i,
    });
    await expect(localeSwitcher).toBeVisible();
    await expect(localeSwitcher).toHaveText('RU');

    // Click to switch to Russian
    await localeSwitcher.click();

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Check that language switched to Russian
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Check that Russian text is now visible
    const headingAfter = page.getByRole('heading', {
      name: /создать аккаунт/i,
    });
    await expect(headingAfter).toBeVisible();

    // Check that switcher now shows "EN" (you can switch back to English)
    const localeSwitcherAfter = page.getByRole('link', {
      name: /switch to english/i,
    });
    await expect(localeSwitcherAfter).toHaveText('EN');

    // Verify URL now includes the Russian locale prefix
    expect(page.url()).toBe('http://localhost:3001/ru/register');
  });

  test('should switch language from RU back to EN', async ({
    page,
    context,
  }) => {
    // Set Russian locale cookie first
    await context.addCookies([
      {
        name: 'NEXT_LOCALE',
        value: 'ru',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Should be in Russian
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Click to switch to English
    const localeSwitcher = page.getByRole('link', {
      name: /switch to english/i,
    });
    await localeSwitcher.click();

    await page.waitForLoadState('networkidle');

    // Should be back in English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const heading = page.getByRole('heading', {
      name: /create account/i,
    });
    await expect(heading).toBeVisible();
  });

  test('should preserve locale when navigating between pages', async ({
    page,
    context,
  }) => {
    // Set Russian locale
    await context.addCookies([
      {
        name: 'NEXT_LOCALE',
        value: 'ru',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should be in Russian
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Navigate to register
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Should still be in Russian
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Should still be in Russian
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
});
