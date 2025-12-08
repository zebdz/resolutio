import { test, expect } from '@playwright/test';

test.describe('Landing Page Navigation', () => {
  test('should navigate to register page when clicking "Get started" button', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Find "Get started" button
    const getStartedButton = page.getByRole('link', { name: /get started/i });
    await expect(getStartedButton).toBeVisible();
    
    // Click it
    await getStartedButton.click();
    
    // Should navigate to /en/register
    await page.waitForURL('http://localhost:3001/en/register');
    expect(page.url()).toBe('http://localhost:3001/en/register');
    
    // Should see register page heading
    const heading = page.getByRole('heading', { name: /create account/i });
    await expect(heading).toBeVisible();
  });

  test('should navigate to login page when clicking "Sign In" button', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Find "Sign In" button
    const signInButton = page.getByRole('link', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
    
    // Click it
    await signInButton.click();
    
    // Should navigate to /en/login
    await page.waitForURL('http://localhost:3001/en/login');
    expect(page.url()).toBe('http://localhost:3001/en/login');
    
    // Should see login page heading
    const heading = page.getByRole('heading', { name: /sign in/i });
    await expect(heading).toBeVisible();
  });

  test('should redirect root to default locale', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to /en (default locale)
    expect(page.url()).toBe('http://localhost:3001/en');
    
    // Should see English content
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('should work with Russian locale', async ({ page }) => {
    await page.goto('/ru');
    await page.waitForLoadState('networkidle');
    
    // Should see Russian text
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    
    // Click Russian "Get started" button
    const getStartedButton = page.getByRole('link', { name: /начать/i });
    await getStartedButton.click();
    
    // Should navigate to /ru/register
    await page.waitForURL('http://localhost:3001/ru/register');
    expect(page.url()).toBe('http://localhost:3001/ru/register');
    
    // Should see Russian heading
    const heading = page.getByRole('heading', { name: /создать аккаунт/i });
    await expect(heading).toBeVisible();
  });
});
