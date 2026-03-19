import leoProfanity from 'leo-profanity';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import {
  PROFANITY_CUSTOM_BLOCKED,
  PROFANITY_WHITELISTED,
  PROFANITY_STEMS,
} from '@/domain/shared/profanity/profanityConfig';

export class LeoProfanityChecker implements ProfanityChecker {
  private static instance: LeoProfanityChecker;

  private constructor() {
    // Default EN dictionary is loaded automatically
    // getDictionary('ru') returns RU words without replacing active dictionary
    const ruWords = leoProfanity.getDictionary('ru');
    leoProfanity.add(ruWords);

    // Auto-generate е-variants for all ё-words in the RU dictionary.
    // Russian speakers often write е instead of ё (e.g., хуево instead of хуёво).
    const yeVariants = ruWords
      .filter((w: string) => w.includes('ё') || w.includes('Ё'))
      .map((w: string) => w.replace(/ё/g, 'е').replace(/Ё/g, 'Е'))
      .filter((w: string) => !ruWords.includes(w));
    leoProfanity.add(yeVariants);

    leoProfanity.add(PROFANITY_CUSTOM_BLOCKED);
    leoProfanity.remove(PROFANITY_WHITELISTED);
  }

  static getInstance(): LeoProfanityChecker {
    if (!LeoProfanityChecker.instance) {
      LeoProfanityChecker.instance = new LeoProfanityChecker();
    }

    return LeoProfanityChecker.instance;
  }

  // Latin→Cyrillic homoglyph map (lowercase only; uppercase handled via toLowerCase)
  private static readonly HOMOGLYPHS: Record<string, string> = {
    a: 'а',
    c: 'с',
    e: 'е',
    o: 'о',
    p: 'р',
    x: 'х',
    y: 'у',
    k: 'к',
    h: 'н',
    b: 'в',
    m: 'м',
    t: 'т',
  };

  containsProfanity(text: string): boolean {
    if (leoProfanity.check(text)) {
      return true;
    }

    // Normalize: ё→е, Latin homoglyphs→Cyrillic
    const normalized = this.normalize(text);

    if (normalized !== text && leoProfanity.check(normalized)) {
      return true;
    }

    // Stem-based matching for Russian morphology
    if (this.containsProfaneStem(normalized)) {
      return true;
    }

    // Strip non-letter characters to catch obfuscation
    // like х.у.е.в.ы.й, б*л*я*т*ь
    const lettersOnly = normalized.replace(/[^\p{L}]/gu, '');

    if (lettersOnly !== normalized.replace(/\s/g, '')) {
      if (leoProfanity.check(lettersOnly)) {
        return true;
      }

      if (this.containsProfaneStem(lettersOnly)) {
        return true;
      }
    }

    // Collapse spaces to catch spaced-out letters: п и з д е ц
    if (normalized.includes(' ')) {
      const collapsed = normalized.replace(/\s/g, '');

      if (leoProfanity.check(collapsed)) {
        return true;
      }

      if (this.containsProfaneStem(collapsed)) {
        return true;
      }
    }

    return false;
  }

  private normalize(text: string): string {
    // ё→е
    let result = text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');

    // Latin homoglyphs→Cyrillic
    result = result.replace(/[a-zA-Z]/g, (ch) => {
      const lower = ch.toLowerCase();

      return LeoProfanityChecker.HOMOGLYPHS[lower] ?? ch;
    });

    return result;
  }

  private containsProfaneStem(text: string): boolean {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    for (const word of words) {
      if (!word) {continue;}

      for (const stem of PROFANITY_STEMS) {
        if (word.startsWith(stem)) {
          return true;
        }
      }
    }

    return false;
  }
}
