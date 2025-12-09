// Centralized locale configuration
export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';

// Helper to check if a string is a valid locale
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
