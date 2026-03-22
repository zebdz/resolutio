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

  // Latin→Cyrillic visual homoglyph map (letters that look alike)
  // (lowercase only; uppercase handled via toLowerCase)
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
    j: 'й', // then й→и normalization handles it
    b: 'в',
    m: 'м',
    t: 'т',
  };

  // Latin→Cyrillic phonetic transliteration map (letters that sound alike).
  // Applied as a second stage after HOMOGLYPHS to fill remaining Latin chars,
  // or directly for mixed-script evasion detection.
  private static readonly TRANSLITERATION: Record<string, string> = {
    a: 'а',
    b: 'б',
    c: 'с',
    d: 'д',
    e: 'е',
    f: 'ф',
    g: 'г',
    h: 'х',
    i: 'и',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    v: 'в',
    x: 'х',
    y: 'у',
    z: 'з',
  };

  // Multi-character Latin→Cyrillic transliteration (digraphs/trigraphs).
  // Processed left-to-right, longest match first, before single-char transliteration.
  // Sorted by length descending for matching priority.
  private static readonly DIGRAPHS: [string, string][] = [
    ['shch', 'щ'],
    ['sch', 'щ'],
    ['ya', 'я'],
    ['yu', 'ю'],
    ['yo', 'ё'],
    ['ye', 'е'],
    ['zh', 'ж'],
    ['sh', 'ш'],
    ['ch', 'ч'],
    ['ts', 'ц'],
    ['kh', 'х'],
  ];

  // Alternative overrides for mixed-script evasion (applied on top of TRANSLITERATION).
  // Only used when text contains both Cyrillic and Latin characters.
  private static readonly MIXED_SCRIPT_OVERRIDES: Record<string, string> = {
    s: 'з', // evasion: Latin s used for Cyrillic з (standard translit: s→с)
  };

  // Alternative digit substitutions for ambiguous digits.
  // Primary: 3→е (ху3вый→хуевый). Alt: 3→з (пи3да→пизда).
  private static readonly ALT_DIGIT_SUBS: Record<string, string> = {
    '3': 'з', // visual: 3 looks like з (primary: 3→е)
    '4': 'ч', // visual: 4 looks like ч (primary: 4→а)
    '9': 'д', // visual: 9 looks like д (no primary mapping)
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

    // Stage 1: Visual homoglyphs normalization (ё→е, Latin lookalikes→Cyrillic)
    const normalized = this.normalize(text);

    if (normalized !== text && leoProfanity.check(normalized)) {
      return true;
    }

    // Stem-based matching for Russian morphology
    if (this.containsProfaneStem(normalized)) {
      return true;
    }

    // Alt-digit normalization: try alternative digit mappings (3→з instead of 3→е).
    // Catches пи3да → пизда (primary gives пиеда which misses).
    const altDigitMap = {
      ...LeoProfanityChecker.DIGIT_SUBS,
      ...LeoProfanityChecker.ALT_DIGIT_SUBS,
    };
    const altDigitNormalized = this.normalize(text, undefined, altDigitMap);

    if (altDigitNormalized !== normalized) {
      if (leoProfanity.check(altDigitNormalized)) {
        return true;
      }

      if (this.containsProfaneStem(altDigitNormalized)) {
        return true;
      }
    }

    // Stage 2: Fill remaining Latin chars with phonetic transliteration.
    // Applied to the homoglyph-normalized result so already-mapped chars (h→н, b→в)
    // stay as-is, avoiding false positives like "hue" → "хуе".
    const fullyNormalized = this.normalize(
      normalized,
      LeoProfanityChecker.TRANSLITERATION
    );

    if (fullyNormalized !== normalized) {
      if (leoProfanity.check(fullyNormalized)) {
        return true;
      }

      if (this.containsProfaneStem(fullyNormalized)) {
        return true;
      }
    }

    // Stage 3: Mixed-script alternative normalization.
    // When text has both Cyrillic and Latin, try full transliteration (h→х, b→б)
    // plus overrides (s→з) directly on the original to catch evasion like Пиsда.
    // Only for mixed-script to avoid false positives on pure English.
    if (this.isMixedScript(text)) {
      const altMap = {
        ...LeoProfanityChecker.TRANSLITERATION,
        ...LeoProfanityChecker.MIXED_SCRIPT_OVERRIDES,
      };
      const altNormalized = this.normalize(text, altMap);

      if (altNormalized !== fullyNormalized && altNormalized !== text) {
        if (leoProfanity.check(altNormalized)) {
          return true;
        }

        if (this.containsProfaneStem(altNormalized)) {
          return true;
        }
      }
    }

    // Stage 4: Full phonetic transliteration (with digraph support).
    // Applies digraphs (ya→я, sh→ш) then full TRANSLITERATION (h→х, b→б, p→п).
    // When digraphs are found: full check (transliteration intent is clear).
    // When no digraphs: stem-only check (avoids infix false positives like "hue"→"хуе").
    const digraphed = this.applyDigraphs(text);
    const fullTranslit = this.normalize(
      digraphed,
      LeoProfanityChecker.TRANSLITERATION
    );

    if (fullTranslit !== fullyNormalized && fullTranslit !== text) {
      if (digraphed !== text) {
        // Digraphs found → full check (transliteration intent is clear)
        if (leoProfanity.check(fullTranslit)) {
          return true;
        }

        if (this.containsProfaneStem(fullTranslit)) {
          return true;
        }
      } else {
        // No digraphs → stem-only check (safe: stems are specific enough
        // to avoid false positives, unlike infixes e.g. "hue"→"хуе")
        if (this.containsStemMatch(fullTranslit)) {
          return true;
        }
      }
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

    // Phrase matching: check collapsed text for multi-word phrases and symbol patterns.
    // Check BOTH normalized (for Cyrillic phrases) and original (for # patterns like #опа).
    const collapsedNormLower = normalized.replace(/\s/g, '').toLowerCase();
    const collapsedOrigLower = text.replace(/\s/g, '').toLowerCase();

    for (const phrase of PROFANITY_PHRASES) {
      if (
        collapsedNormLower.includes(phrase) ||
        collapsedOrigLower.includes(phrase)
      ) {
        return true;
      }
    }

    return false;
  }

  private normalize(
    text: string,
    charMap?: Record<string, string>,
    digitMap?: Record<string, string>
  ): string {
    // ё→е, й→и (common evasion substitutions within Cyrillic)
    let result = text
      .replace(/ё/g, 'е')
      .replace(/Ё/g, 'Е')
      .replace(/й/g, 'и')
      .replace(/Й/g, 'И');

    // Latin→Cyrillic using provided map (or HOMOGLYPHS by default)
    const map = charMap ?? LeoProfanityChecker.HOMOGLYPHS;

    result = result.replace(/[a-zA-Z]/g, (ch) => {
      const lower = ch.toLowerCase();

      return map[lower] ?? ch;
    });

    // Digit→Cyrillic
    const digits = digitMap ?? LeoProfanityChecker.DIGIT_SUBS;

    result = result.replace(/[0-9]/g, (ch) => {
      return digits[ch] ?? ch;
    });

    // Special char→Cyrillic (@→а, $→с, ₽→р, €→е)
    result = result.replace(/[@$₽€]/g, (ch) => {
      return LeoProfanityChecker.SPECIAL_CHAR_SUBS[ch] ?? ch;
    });

    return result;
  }

  // Replace multi-char Latin sequences with Cyrillic (ya→я, sh→ш, etc.).
  // Scans left-to-right, longest match first. Non-matching chars stay as-is.
  private applyDigraphs(text: string): string {
    let result = '';
    let i = 0;

    while (i < text.length) {
      let matched = false;

      for (const [digraph, replacement] of LeoProfanityChecker.DIGRAPHS) {
        const len = digraph.length;

        if (
          i + len <= text.length &&
          text.substring(i, i + len).toLowerCase() === digraph
        ) {
          result += replacement;
          i += len;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result += text[i];
        i++;
      }
    }

    return result;
  }

  private isMixedScript(text: string): boolean {
    return /[\u0400-\u04FF]/.test(text) && /[a-zA-Z]/.test(text);
  }

  // Stem-only check (no infixes). Used for full transliteration of pure Latin text
  // where infix matching would cause false positives (e.g. "hue" → "хуе").
  private containsStemMatch(text: string): boolean {
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
    }

    return false;
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
