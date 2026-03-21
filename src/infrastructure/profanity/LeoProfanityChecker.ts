import leoProfanity from 'leo-profanity';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import {
  PROFANITY_CUSTOM_BLOCKED,
  PROFANITY_WHITELISTED,
  PROFANITY_STEMS,
  PROFANITY_INFIXES,
  PROFANITY_PHRASES,
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

  // Digit→Cyrillic substitution map (most common profanity evasion substitutions)
  private static readonly DIGIT_SUBS: Record<string, string> = {
    '0': 'о',
    '3': 'е', // ху3вый → хуевый
    '4': 'а', // муд4к → мудак
    '6': 'б', // 6лять → блять
  };

  // Special char→Cyrillic substitution map (visual resemblance)
  private static readonly SPECIAL_CHAR_SUBS: Record<string, string> = {
    '@': 'а',
    $: 'с',
    '₽': 'р',
    '€': 'е',
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

    // Strip non-letter characters from ORIGINAL text to catch cases where
    // special chars replace letters ambiguously (Еб$ть → Ебть, $ could be а or с)
    const originalLettersOnly = text.replace(/[^\p{L}]/gu, '');

    if (originalLettersOnly !== text.replace(/\s/g, '')) {
      const normalizedStripped = this.normalize(originalLettersOnly);

      if (leoProfanity.check(normalizedStripped)) {
        return true;
      }

      if (this.containsProfaneStem(normalizedStripped)) {
        return true;
      }
    }

    // Strip non-letter characters from normalized text to catch obfuscation
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

    // Phrase matching: check collapsed normalized text for multi-word phrases
    const collapsedLower = normalized.replace(/\s/g, '').toLowerCase();

    for (const phrase of PROFANITY_PHRASES) {
      if (collapsedLower.includes(phrase)) {
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

    // Digit→Cyrillic (0→о, 3→е, 4→а, 6→б)
    result = result.replace(/[0-9]/g, (ch) => {
      return LeoProfanityChecker.DIGIT_SUBS[ch] ?? ch;
    });

    // Special char→Cyrillic (@→а, $→с, ₽→р, €→е)
    result = result.replace(/[@$₽€]/g, (ch) => {
      return LeoProfanityChecker.SPECIAL_CHAR_SUBS[ch] ?? ch;
    });

    return result;
  }

  private containsProfaneStem(text: string): boolean {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    for (const word of words) {
      if (!word) {
        continue;
      }

      for (const stem of PROFANITY_STEMS) {
        if (word.startsWith(stem)) {
          return true;
        }
      }

      for (const infix of PROFANITY_INFIXES) {
        if (word.includes(infix)) {
          return true;
        }
      }
    }

    return false;
  }
}
