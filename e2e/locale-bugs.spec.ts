import { test, expect } from '@playwright/test';

test.describe('Locale Routing Bugs', () => {
  test('should redirect /register to /en/register (default locale)', async ({ page }) => {
    // Navigate to /register without locale prefix
    await page.goto('/register');
    
    // Should be redirected to /en/register
    await expect(page).toHaveURL('/en/register');
    
    // Should show the registration form, not the landing page
    await expect(page.getByRole('heading', { name: /create account|sign up/i })).toBeVisible();
    
    // Should NOT show landing page content
    await expect(page.getByText('Take control of your life')).not.toBeVisible();
  });

  test('should redirect /login to /en/login (default locale)', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/en/login');
    await expect(page.getByRole('heading', { name: /sign in|welcome back/i })).toBeVisible();
  });

  test('should NOT create double locale prefix when switching from RU to EN', async ({ page }) => {
    // Start on Russian registration page
    await page.goto('/ru/register');
    await expect(page).toHaveURL('/ru/register');
    
    // Verify we're on Russian page
    await expect(page.getByRole('heading', { name: 'Создать аккаунт' })).toBeVisible();
    
    // Click the locale switcher to switch to English
    // The switcher shows the target locale, so it should show "EN"
    const localeSwitcher = page.getByRole('link', { name: /switch to english/i });
    await localeSwitcher.click();
    
    // Should navigate to /en/register, NOT /ru/ru/register or /en/ru/register
    await expect(page).toHaveURL('/en/register');
    
    // Should show English content
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('should NOT create double locale prefix when switching from EN to RU', async ({ page }) => {
    // Start on English registration page
    await page.goto('/en/register');
    await expect(page).toHaveURL('/en/register');
    
    // Verify we're on English page
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    
    // Click the locale switcher to switch to Russian
    // The switcher shows the target locale, so it should show "RU"
    const localeSwitcher = page.getByRole('link', { name: /switch to russian/i });
    await localeSwitcher.click();
    
    // Should navigate to /ru/register, NOT /en/en/register or /ru/en/register
    await expect(page).toHaveURL('/ru/register');
    
    // Should show Russian content
    await expect(page.getByRole('heading', { name: 'Создать аккаунт' })).toBeVisible();
  });

  test('should handle locale switching on nested routes correctly', async ({ page }) => {
    // If we add more nested routes in the future, test them too
    await page.goto('/ru/login');
    await expect(page).toHaveURL('/ru/login');
    
    const localeSwitcher = page.getByRole('link', { name: /switch to english/i });
    await localeSwitcher.click();
    
    await expect(page).toHaveURL('/en/login');
  });

  test('should redirect root path / to /en (default locale)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/en');
    
    // Should show landing page with English content
    await expect(page.getByRole('heading', { name: 'Take control of your life' })).toBeVisible();
  });
});
