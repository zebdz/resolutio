import { describe, it, expect } from 'vitest';
import { LeoProfanityChecker } from '../LeoProfanityChecker';

describe('LeoProfanityChecker', () => {
  const checker = LeoProfanityChecker.getInstance();

  it('should detect English profanity', () => {
    expect(checker.containsProfanity('this is shit')).toBe(true);
  });

  it('should detect Russian profanity', () => {
    expect(checker.containsProfanity('это блять')).toBe(true);
  });

  it('should pass clean text', () => {
    expect(checker.containsProfanity('hello world')).toBe(false);
  });

  it('should pass clean Russian text', () => {
    expect(checker.containsProfanity('привет мир')).toBe(false);
  });

  it('should return same singleton instance', () => {
    const a = LeoProfanityChecker.getInstance();
    const b = LeoProfanityChecker.getInstance();
    expect(a).toBe(b);
  });

  it('should handle empty string', () => {
    expect(checker.containsProfanity('')).toBe(false);
  });

  it('should handle whitespace-only string', () => {
    expect(checker.containsProfanity('   ')).toBe(false);
  });

  // ===== ё/е auto-generated variants =====

  describe('ё/е auto-generated variants', () => {
    it('should detect хуёво (ё, in library)', () => {
      expect(checker.containsProfanity('хуёво')).toBe(true);
    });

    it('should detect хуево (е, auto-generated)', () => {
      expect(checker.containsProfanity('хуево')).toBe(true);
    });

    it('should detect хуёв (ё, in library)', () => {
      expect(checker.containsProfanity('хуёв')).toBe(true);
    });

    it('should detect хуев (е, auto-generated)', () => {
      expect(checker.containsProfanity('хуев')).toBe(true);
    });

    it('should detect ёбнуть (ё, in library)', () => {
      expect(checker.containsProfanity('ёбнуть')).toBe(true);
    });

    it('should detect ебнуть (е, auto-generated)', () => {
      expect(checker.containsProfanity('ебнуть')).toBe(true);
    });

    it('should detect долбоёб (ё, in library)', () => {
      expect(checker.containsProfanity('долбоёб')).toBe(true);
    });

    it('should detect долбоеб (е, auto-generated)', () => {
      expect(checker.containsProfanity('долбоеб')).toBe(true);
    });

    it('should detect ебём (ё, in library)', () => {
      expect(checker.containsProfanity('ебём')).toBe(true);
    });

    it('should detect ебем (е, auto-generated)', () => {
      expect(checker.containsProfanity('ебем')).toBe(true);
    });

    it('should detect ёпт (ё, in library)', () => {
      expect(checker.containsProfanity('ёпт')).toBe(true);
    });

    it('should detect епт (е, from custom list)', () => {
      expect(checker.containsProfanity('епт')).toBe(true);
    });
  });

  // ===== ё→е normalization in input =====

  describe('ё→е normalization in input', () => {
    it('should detect хуёвый (ё in input → хуевый from custom list)', () => {
      expect(checker.containsProfanity('хуёвый')).toBe(true);
    });

    it('should detect хуёвая (ё in input → хуевая from custom list)', () => {
      expect(checker.containsProfanity('хуёвая')).toBe(true);
    });
  });

  // ===== Custom blocked: хуй derivatives =====

  describe('custom blocked: хуй derivatives', () => {
    // nominative
    it('should detect хуевый', () => {
      expect(checker.containsProfanity('хуевый')).toBe(true);
    });

    it('should detect хуевая', () => {
      expect(checker.containsProfanity('хуевая')).toBe(true);
    });

    it('should detect хуевое', () => {
      expect(checker.containsProfanity('хуевое')).toBe(true);
    });

    it('should detect хуевые', () => {
      expect(checker.containsProfanity('хуевые')).toBe(true);
    });

    // non-nominative adjective forms
    it('should detect хуевого (родительный)', () => {
      expect(checker.containsProfanity('хуевого')).toBe(true);
    });

    it('should detect хуевой (творительный ж.р.)', () => {
      expect(checker.containsProfanity('хуевой')).toBe(true);
    });

    it('should detect хуевому (дательный)', () => {
      expect(checker.containsProfanity('хуевому')).toBe(true);
    });

    it('should detect хуевым (творительный м.р.)', () => {
      expect(checker.containsProfanity('хуевым')).toBe(true);
    });

    it('should detect хуевых (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('хуевых')).toBe(true);
    });

    it('should detect хуевыми (творительный мн.ч.)', () => {
      expect(checker.containsProfanity('хуевыми')).toBe(true);
    });

    it('should detect хуевом (предложный)', () => {
      expect(checker.containsProfanity('хуевом')).toBe(true);
    });

    it('should detect хуевую (винительный ж.р.)', () => {
      expect(checker.containsProfanity('хуевую')).toBe(true);
    });

    // other derivatives
    it('should detect хуевина', () => {
      expect(checker.containsProfanity('хуевина')).toBe(true);
    });

    it('should detect хуеплет', () => {
      expect(checker.containsProfanity('хуеплет')).toBe(true);
    });

    it('should detect хуесос', () => {
      expect(checker.containsProfanity('хуесос')).toBe(true);
    });

    it('should detect хуесоска', () => {
      expect(checker.containsProfanity('хуесоска')).toBe(true);
    });

    it('should detect хуесосов (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('хуесосов')).toBe(true);
    });

    it('should detect хуесоской (творительный)', () => {
      expect(checker.containsProfanity('хуесоской')).toBe(true);
    });

    it('should detect охуеть', () => {
      expect(checker.containsProfanity('охуеть')).toBe(true);
    });

    it('should detect охуенный', () => {
      expect(checker.containsProfanity('охуенный')).toBe(true);
    });

    it('should detect охуенного (родительный)', () => {
      expect(checker.containsProfanity('охуенного')).toBe(true);
    });

    it('should detect охуительный', () => {
      expect(checker.containsProfanity('охуительный')).toBe(true);
    });

    it('should detect ахуеть', () => {
      expect(checker.containsProfanity('ахуеть')).toBe(true);
    });

    it('should detect ахуенный', () => {
      expect(checker.containsProfanity('ахуенный')).toBe(true);
    });

    it('should detect ахуенного (родительный)', () => {
      expect(checker.containsProfanity('ахуенного')).toBe(true);
    });
  });

  // ===== Custom blocked: мудак =====

  describe('custom blocked: мудак', () => {
    it('should detect мудак', () => {
      expect(checker.containsProfanity('мудак')).toBe(true);
    });

    it('should detect мудака (родительный)', () => {
      expect(checker.containsProfanity('мудака')).toBe(true);
    });

    it('should detect мудаку (дательный)', () => {
      expect(checker.containsProfanity('мудаку')).toBe(true);
    });

    it('should detect мудаком (творительный)', () => {
      expect(checker.containsProfanity('мудаком')).toBe(true);
    });

    it('should detect мудаке (предложный)', () => {
      expect(checker.containsProfanity('мудаке')).toBe(true);
    });

    it('should detect мудаки (мн.ч.)', () => {
      expect(checker.containsProfanity('мудаки')).toBe(true);
    });

    it('should detect мудаков (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('мудаков')).toBe(true);
    });

    it('should detect мудакам (дательный мн.ч.)', () => {
      expect(checker.containsProfanity('мудакам')).toBe(true);
    });

    it('should detect мудаками (творительный мн.ч.)', () => {
      expect(checker.containsProfanity('мудаками')).toBe(true);
    });

    it('should detect мудаках (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('мудаках')).toBe(true);
    });

    it('should detect мудачье', () => {
      expect(checker.containsProfanity('мудачье')).toBe(true);
    });

    it('should detect мудачок', () => {
      expect(checker.containsProfanity('мудачок')).toBe(true);
    });

    it('should detect мудила', () => {
      expect(checker.containsProfanity('мудила')).toBe(true);
    });

    it('should detect мудило', () => {
      expect(checker.containsProfanity('мудило')).toBe(true);
    });
  });

  // ===== Custom blocked: гандон/гондон =====

  describe('custom blocked: гандон/гондон', () => {
    it('should detect гандон', () => {
      expect(checker.containsProfanity('гандон')).toBe(true);
    });

    it('should detect гондон', () => {
      expect(checker.containsProfanity('гондон')).toBe(true);
    });

    it('should detect гандона (родительный)', () => {
      expect(checker.containsProfanity('гандона')).toBe(true);
    });

    it('should detect гандоном (творительный)', () => {
      expect(checker.containsProfanity('гандоном')).toBe(true);
    });

    it('should detect гондонов (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('гондонов')).toBe(true);
    });

    it('should detect гандонка', () => {
      expect(checker.containsProfanity('гандонка')).toBe(true);
    });

    it('should detect гондонка', () => {
      expect(checker.containsProfanity('гондонка')).toBe(true);
    });

    it('should detect гандонкой (творительный)', () => {
      expect(checker.containsProfanity('гандонкой')).toBe(true);
    });

    it('should detect гондонок (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('гондонок')).toBe(true);
    });
  });

  // ===== Custom blocked: шлюха =====

  describe('custom blocked: шлюха', () => {
    it('should detect шлюха', () => {
      expect(checker.containsProfanity('шлюха')).toBe(true);
    });

    it('should detect шлюхи (родительный)', () => {
      expect(checker.containsProfanity('шлюхи')).toBe(true);
    });

    it('should detect шлюхе (дательный)', () => {
      expect(checker.containsProfanity('шлюхе')).toBe(true);
    });

    it('should detect шлюху (винительный)', () => {
      expect(checker.containsProfanity('шлюху')).toBe(true);
    });

    it('should detect шлюхой (творительный)', () => {
      expect(checker.containsProfanity('шлюхой')).toBe(true);
    });

    it('should detect шлюхами (творительный мн.ч.)', () => {
      expect(checker.containsProfanity('шлюхами')).toBe(true);
    });
  });

  // ===== Custom blocked: пидор/пидар =====

  describe('custom blocked: пидор/пидар', () => {
    it('should detect пидор', () => {
      expect(checker.containsProfanity('пидор')).toBe(true);
    });

    it('should detect пидора (родительный)', () => {
      expect(checker.containsProfanity('пидора')).toBe(true);
    });

    it('should detect пидором (творительный)', () => {
      expect(checker.containsProfanity('пидором')).toBe(true);
    });

    it('should detect пидоры (мн.ч.)', () => {
      expect(checker.containsProfanity('пидоры')).toBe(true);
    });

    it('should detect пидоров (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('пидоров')).toBe(true);
    });

    it('should detect пидорам (дательный мн.ч.)', () => {
      expect(checker.containsProfanity('пидорам')).toBe(true);
    });

    it('should detect пидорас', () => {
      expect(checker.containsProfanity('пидорас')).toBe(true);
    });

    it('should detect пидорасы (мн.ч.)', () => {
      expect(checker.containsProfanity('пидорасы')).toBe(true);
    });

    it('should detect пидар', () => {
      expect(checker.containsProfanity('пидар')).toBe(true);
    });

    it('should detect пидары (мн.ч.)', () => {
      expect(checker.containsProfanity('пидары')).toBe(true);
    });

    // non-nominative forms not in custom list (will fail before stem matching)
    it('should detect пидорами (творительный мн.ч.)', () => {
      expect(checker.containsProfanity('пидорами')).toBe(true);
    });

    it('should detect пидорах (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('пидорах')).toBe(true);
    });
  });

  // ===== Custom blocked: жопа =====

  describe('custom blocked: жопа', () => {
    it('should detect жопа', () => {
      expect(checker.containsProfanity('жопа')).toBe(true);
    });

    it('should detect жопы (родительный)', () => {
      expect(checker.containsProfanity('жопы')).toBe(true);
    });

    it('should detect жопе (дательный)', () => {
      expect(checker.containsProfanity('жопе')).toBe(true);
    });

    it('should detect жопу (винительный)', () => {
      expect(checker.containsProfanity('жопу')).toBe(true);
    });

    it('should detect жопой (творительный)', () => {
      expect(checker.containsProfanity('жопой')).toBe(true);
    });

    it('should detect жопами (творительный мн.ч.)', () => {
      expect(checker.containsProfanity('жопами')).toBe(true);
    });

    it('should detect жопах (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('жопах')).toBe(true);
    });
  });

  // ===== Custom blocked: говно =====

  describe('custom blocked: говно', () => {
    it('should detect говно', () => {
      expect(checker.containsProfanity('говно')).toBe(true);
    });

    it('should detect говна (родительный)', () => {
      expect(checker.containsProfanity('говна')).toBe(true);
    });

    it('should detect говну (дательный)', () => {
      expect(checker.containsProfanity('говну')).toBe(true);
    });

    it('should detect говном (творительный)', () => {
      expect(checker.containsProfanity('говном')).toBe(true);
    });

    it('should detect говне (предложный)', () => {
      expect(checker.containsProfanity('говне')).toBe(true);
    });

    it('should detect говнюк', () => {
      expect(checker.containsProfanity('говнюк')).toBe(true);
    });

    it('should detect говнюков (родительный мн.ч.)', () => {
      expect(checker.containsProfanity('говнюков')).toBe(true);
    });

    it('should detect говнище', () => {
      expect(checker.containsProfanity('говнище')).toBe(true);
    });

    it('should detect говняный', () => {
      expect(checker.containsProfanity('говняный')).toBe(true);
    });

    it('should detect говняная', () => {
      expect(checker.containsProfanity('говняная')).toBe(true);
    });

    it('should detect говняное', () => {
      expect(checker.containsProfanity('говняное')).toBe(true);
    });

    // non-nominative adjective forms (will fail before stem matching)
    it('should detect говняного (родительный)', () => {
      expect(checker.containsProfanity('говняного')).toBe(true);
    });

    it('should detect говняным (творительный)', () => {
      expect(checker.containsProfanity('говняным')).toBe(true);
    });
  });

  // ===== Custom blocked: хер =====

  describe('custom blocked: хер', () => {
    it('should detect херня', () => {
      expect(checker.containsProfanity('херня')).toBe(true);
    });

    it('should detect херни (родительный)', () => {
      expect(checker.containsProfanity('херни')).toBe(true);
    });

    it('should detect херне (дательный)', () => {
      expect(checker.containsProfanity('херне')).toBe(true);
    });

    it('should detect херню (винительный)', () => {
      expect(checker.containsProfanity('херню')).toBe(true);
    });

    it('should detect херней (творительный)', () => {
      expect(checker.containsProfanity('херней')).toBe(true);
    });

    it('should detect херово', () => {
      expect(checker.containsProfanity('херово')).toBe(true);
    });

    it('should detect херовый', () => {
      expect(checker.containsProfanity('херовый')).toBe(true);
    });

    it('should detect херовая', () => {
      expect(checker.containsProfanity('херовая')).toBe(true);
    });

    it('should detect херовое', () => {
      expect(checker.containsProfanity('херовое')).toBe(true);
    });

    // non-nominative adjective forms (will fail before stem matching)
    it('should detect херовой (творительный ж.р.)', () => {
      expect(checker.containsProfanity('херовой')).toBe(true);
    });

    it('should detect херовому (дательный)', () => {
      expect(checker.containsProfanity('херовому')).toBe(true);
    });

    it('should detect херовым (творительный м.р.)', () => {
      expect(checker.containsProfanity('херовым')).toBe(true);
    });

    it('should detect херовых (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('херовых')).toBe(true);
    });
  });

  // ===== Custom blocked: дрочить =====

  describe('custom blocked: дрочить', () => {
    it('should detect дрочить', () => {
      expect(checker.containsProfanity('дрочить')).toBe(true);
    });

    it('should detect дрочит', () => {
      expect(checker.containsProfanity('дрочит')).toBe(true);
    });

    it('should detect дрочила', () => {
      expect(checker.containsProfanity('дрочила')).toBe(true);
    });

    it('should detect дрочу', () => {
      expect(checker.containsProfanity('дрочу')).toBe(true);
    });

    it('should detect дрочишь', () => {
      expect(checker.containsProfanity('дрочишь')).toBe(true);
    });

    it('should detect дрочат', () => {
      expect(checker.containsProfanity('дрочат')).toBe(true);
    });
  });

  // ===== Custom blocked: срать/срака =====

  describe('custom blocked: срать/срака', () => {
    it('should detect срать', () => {
      expect(checker.containsProfanity('срать')).toBe(true);
    });

    it('should detect срака', () => {
      expect(checker.containsProfanity('срака')).toBe(true);
    });

    it('should detect сракой (творительный)', () => {
      expect(checker.containsProfanity('сракой')).toBe(true);
    });

    it('should detect срань', () => {
      expect(checker.containsProfanity('срань')).toBe(true);
    });
  });

  // ===== Custom blocked: залупа/золупа =====

  describe('custom blocked: залупа/золупа', () => {
    it('should detect залупа', () => {
      expect(checker.containsProfanity('залупа')).toBe(true);
    });

    it('should detect залупу (винительный)', () => {
      expect(checker.containsProfanity('залупу')).toBe(true);
    });

    it('should detect залупой (творительный)', () => {
      expect(checker.containsProfanity('залупой')).toBe(true);
    });

    it('should detect золупа', () => {
      expect(checker.containsProfanity('золупа')).toBe(true);
    });

    it('should detect золупу (винительный)', () => {
      expect(checker.containsProfanity('золупу')).toBe(true);
    });

    it('should detect золупой (творительный)', () => {
      expect(checker.containsProfanity('золупой')).toBe(true);
    });
  });

  // ===== Custom blocked: минет/миньет/миннет =====

  describe('custom blocked: минет/миньет/миннет', () => {
    it('should detect минет', () => {
      expect(checker.containsProfanity('минет')).toBe(true);
    });

    it('should detect минетом (творительный)', () => {
      expect(checker.containsProfanity('минетом')).toBe(true);
    });

    it('should detect миньет', () => {
      expect(checker.containsProfanity('миньет')).toBe(true);
    });

    it('should detect миньетом (творительный)', () => {
      expect(checker.containsProfanity('миньетом')).toBe(true);
    });

    it('should detect миннет', () => {
      expect(checker.containsProfanity('миннет')).toBe(true);
    });

    it('should detect миннетом (творительный)', () => {
      expect(checker.containsProfanity('миннетом')).toBe(true);
    });
  });

  // ===== Custom blocked: членосос =====

  describe('custom blocked: членосос', () => {
    it('should detect членосос', () => {
      expect(checker.containsProfanity('членосос')).toBe(true);
    });

    it('should detect членососка', () => {
      expect(checker.containsProfanity('членососка')).toBe(true);
    });
  });

  // ===== Library built-in (sanity checks) =====

  describe('library built-in (sanity checks)', () => {
    it('should detect нахуй', () => {
      expect(checker.containsProfanity('иди нахуй')).toBe(true);
    });

    it('should detect пиздец', () => {
      expect(checker.containsProfanity('пиздец')).toBe(true);
    });

    it('should detect сука', () => {
      expect(checker.containsProfanity('сука')).toBe(true);
    });

    it('should detect ебать', () => {
      expect(checker.containsProfanity('ебать')).toBe(true);
    });

    it('should detect блядь', () => {
      expect(checker.containsProfanity('блядь')).toBe(true);
    });

    it('should detect похуй', () => {
      expect(checker.containsProfanity('похуй')).toBe(true);
    });
  });

  // ===== Obfuscation: inserted separators =====

  describe('obfuscation: inserted separators between letters', () => {
    it('should detect х.у.е.в.ы.й (dots)', () => {
      expect(checker.containsProfanity('х.у.е.в.ы.й')).toBe(true);
    });

    it('should detect х-у-е-в-ы-й (dashes)', () => {
      expect(checker.containsProfanity('х-у-е-в-ы-й')).toBe(true);
    });

    it('should detect п и з д е ц (spaces)', () => {
      expect(checker.containsProfanity('п и з д е ц')).toBe(true);
    });

    it('should detect б*л*я*т*ь (asterisks)', () => {
      expect(checker.containsProfanity('б*л*я*т*ь')).toBe(true);
    });

    it('should detect ху_ев_ый (underscores)', () => {
      expect(checker.containsProfanity('ху_ев_ый')).toBe(true);
    });

    it('should detect м.у" д.а" к (mixed separators)', () => {
      expect(checker.containsProfanity('м.у"д.а"к')).toBe(true);
    });

    it('should detect г о в н о (spaced out)', () => {
      expect(checker.containsProfanity('г о в н о')).toBe(true);
    });

    it('should detect ш~л~ю~х~а (tildes)', () => {
      expect(checker.containsProfanity('ш~л~ю~х~а')).toBe(true);
    });

    it('should detect е!б!а!т!ь (exclamation marks)', () => {
      expect(checker.containsProfanity('е!б!а!т!ь')).toBe(true);
    });

    it('should NOT flag clean text with separators', () => {
      expect(checker.containsProfanity('п.р.и.в.е.т')).toBe(false);
    });

    it('should NOT flag normal punctuation in clean sentence', () => {
      expect(checker.containsProfanity('Привет, мир! Как дела?')).toBe(false);
    });
  });

  // ===== Obfuscation: Latin/Cyrillic homoglyphs =====

  describe('obfuscation: Latin-Cyrillic homoglyphs', () => {
    // Latin e → Cyrillic е
    it('should detect хуeвый (Latin e)', () => {
      expect(checker.containsProfanity('хуeвый')).toBe(true);
    });

    // Latin a → Cyrillic а
    it('should detect мудaк (Latin a)', () => {
      expect(checker.containsProfanity('мудaк')).toBe(true);
    });

    // Latin o → Cyrillic о
    it('should detect гoвно (Latin o)', () => {
      expect(checker.containsProfanity('гoвно')).toBe(true);
    });

    // Latin c → Cyrillic с
    it('should detect cука (Latin c)', () => {
      expect(checker.containsProfanity('cука')).toBe(true);
    });

    // Latin p → Cyrillic р
    it('should detect пидop (Latin o and p)', () => {
      expect(checker.containsProfanity('пидop')).toBe(true);
    });

    // Latin x → Cyrillic х
    it('should detect xуевый (Latin x)', () => {
      expect(checker.containsProfanity('xуевый')).toBe(true);
    });

    // Latin y → Cyrillic у
    it('should detect хyевый (Latin y)', () => {
      expect(checker.containsProfanity('хyевый')).toBe(true);
    });

    // Multiple substitutions
    it('should detect xyeвый (Latin x, y, e)', () => {
      expect(checker.containsProfanity('xyeвый')).toBe(true);
    });

    // Combined with separator obfuscation
    it('should detect ху"e"вый (Latin e with quotes)', () => {
      expect(checker.containsProfanity('ху"e"вый')).toBe(true);
    });

    // Uppercase Latin
    it('should detect ХУEВЫЙ (uppercase Latin E)', () => {
      expect(checker.containsProfanity('ХУEВЫЙ')).toBe(true);
    });

    it('should NOT flag clean text with Latin chars', () => {
      expect(checker.containsProfanity('hello мир')).toBe(false);
    });

    it('should NOT flag clean mixed-script text', () => {
      expect(checker.containsProfanity('email: test@example.com')).toBe(false);
    });

    it('should detect xуeть (Latin x and e)', () => {
      expect(checker.containsProfanity('xуeть')).toBe(true);
    });

    it('should detect ааааxуeть (Latin x and e with prefix)', () => {
      expect(checker.containsProfanity('ааааxуeть')).toBe(true);
    });
  });

  // ===== Missing stems and misspellings =====

  describe('missing stems and common misspellings', () => {
    // хуе- derivatives missing from stems
    it('should detect хуемое', () => {
      expect(checker.containsProfanity('хуемое')).toBe(true);
    });

    it('should detect хуеный', () => {
      expect(checker.containsProfanity('хуеный')).toBe(true);
    });

    // хер as standalone (in custom blocked, not as stem)
    it('should detect хер', () => {
      expect(checker.containsProfanity('хер')).toBe(true);
    });

    it('should NOT flag Херсон', () => {
      expect(checker.containsProfanity('Херсон')).toBe(false);
    });

    it('should NOT flag херувим', () => {
      expect(checker.containsProfanity('херувим')).toBe(false);
    });

    // пизд- prefixed derivatives
    it('should detect пиздос', () => {
      expect(checker.containsProfanity('пиздос')).toBe(true);
    });

    it('should detect пиздосня', () => {
      expect(checker.containsProfanity('пиздосня')).toBe(true);
    });

    it('should detect распиздяй', () => {
      expect(checker.containsProfanity('распиздяй')).toBe(true);
    });

    it('should detect распиздел', () => {
      expect(checker.containsProfanity('распиздел')).toBe(true);
    });

    it('should detect роспиздня', () => {
      expect(checker.containsProfanity('роспиздня')).toBe(true);
    });

    it('should detect роспиздел', () => {
      expect(checker.containsProfanity('роспиздел')).toBe(true);
    });

    it('should detect роспиздяй', () => {
      expect(checker.containsProfanity('роспиздяй')).toBe(true);
    });

    // пизд- with other prefixes (via infix matching)
    it('should detect допиздел', () => {
      expect(checker.containsProfanity('допиздел')).toBe(true);
    });

    it('should detect напиздел', () => {
      expect(checker.containsProfanity('напиздел')).toBe(true);
    });

    it('should detect отпиздил', () => {
      expect(checker.containsProfanity('отпиздил')).toBe(true);
    });

    it('should detect запиздел', () => {
      expect(checker.containsProfanity('запиздел')).toBe(true);
    });

    // еб- prefixed (via infix matching)
    it('should detect доебал', () => {
      expect(checker.containsProfanity('доебал')).toBe(true);
    });

    it('should detect отъебал', () => {
      expect(checker.containsProfanity('отъебал')).toBe(true);
    });

    // еб- derivatives
    it('should detect ебан', () => {
      expect(checker.containsProfanity('ебан')).toBe(true);
    });

    it('should detect уебан', () => {
      expect(checker.containsProfanity('уебан')).toBe(true);
    });

    it('should detect долбое (е-variant)', () => {
      expect(checker.containsProfanity('долбое')).toBe(true);
    });

    it('should detect далбое (misspelling)', () => {
      expect(checker.containsProfanity('далбое')).toBe(true);
    });

    it('should detect ебобо', () => {
      expect(checker.containsProfanity('ебобо')).toBe(true);
    });

    // педераст and misspellings
    it('should detect педарас', () => {
      expect(checker.containsProfanity('педарас')).toBe(true);
    });

    it('should detect педорас', () => {
      expect(checker.containsProfanity('педорас')).toBe(true);
    });

    it('should detect педораст', () => {
      expect(checker.containsProfanity('педораст')).toBe(true);
    });

    it('should detect педараст', () => {
      expect(checker.containsProfanity('педараст')).toBe(true);
    });

    it('should detect педераст', () => {
      expect(checker.containsProfanity('педераст')).toBe(true);
    });

    it('should detect пидераст', () => {
      expect(checker.containsProfanity('пидераст')).toBe(true);
    });

    it('should detect педираст', () => {
      expect(checker.containsProfanity('педираст')).toBe(true);
    });

    it('should detect пидираст', () => {
      expect(checker.containsProfanity('пидираст')).toBe(true);
    });

    // пезда/пизда misspellings and -лиз compounds
    it('should detect пезда', () => {
      expect(checker.containsProfanity('пезда')).toBe(true);
    });

    it('should detect пездализ', () => {
      expect(checker.containsProfanity('пездализ')).toBe(true);
    });

    it('should detect пиздолиз', () => {
      expect(checker.containsProfanity('пиздолиз')).toBe(true);
    });

    it('should detect пиздализ', () => {
      expect(checker.containsProfanity('пиздализ')).toBe(true);
    });

    it('should detect пездолиз', () => {
      expect(checker.containsProfanity('пездолиз')).toBe(true);
    });

    it('should detect пездолис', () => {
      expect(checker.containsProfanity('пездолис')).toBe(true);
    });

    it('should detect пездалис', () => {
      expect(checker.containsProfanity('пездалис')).toBe(true);
    });

    it('should detect пиздолис', () => {
      expect(checker.containsProfanity('пиздолис')).toBe(true);
    });

    it('should detect пиздалис', () => {
      expect(checker.containsProfanity('пиздалис')).toBe(true);
    });

    it('should detect пиздас', () => {
      expect(checker.containsProfanity('пиздас')).toBe(true);
    });
  });

  // ===== Words from manual testing sessions =====

  describe('infix matching: prefixed profanity', () => {
    it('should detect допиздел', () => {
      expect(checker.containsProfanity('допиздел')).toBe(true);
    });

    it('should detect напиздел', () => {
      expect(checker.containsProfanity('напиздел')).toBe(true);
    });

    it('should detect отпиздил', () => {
      expect(checker.containsProfanity('отпиздил')).toBe(true);
    });

    it('should detect запиздел', () => {
      expect(checker.containsProfanity('запиздел')).toBe(true);
    });

    it('should detect доебал', () => {
      expect(checker.containsProfanity('доебал')).toBe(true);
    });

    it('should detect отъебал', () => {
      expect(checker.containsProfanity('отъебал')).toBe(true);
    });

    it('should detect выебу', () => {
      expect(checker.containsProfanity('выебу')).toBe(true);
    });

    it('should detect вротвыебу', () => {
      expect(checker.containsProfanity('вротвыебу')).toBe(true);
    });

    it('should detect разъибал', () => {
      expect(checker.containsProfanity('разъибал')).toBe(true);
    });

    it('should detect абъибал', () => {
      expect(checker.containsProfanity('абъибал')).toBe(true);
    });
  });

  describe('misspellings: ибан/ебон variants', () => {
    it('should detect ибануть', () => {
      expect(checker.containsProfanity('ибануть')).toBe(true);
    });

    it('should detect ибанутый', () => {
      expect(checker.containsProfanity('ибанутый')).toBe(true);
    });

    it('should detect ебонуть', () => {
      expect(checker.containsProfanity('ебонуть')).toBe(true);
    });

    it('should detect ебонутый', () => {
      expect(checker.containsProfanity('ебонутый')).toBe(true);
    });

    it('should detect ебонутая', () => {
      expect(checker.containsProfanity('ебонутая')).toBe(true);
    });
  });

  describe('compound animal profanity', () => {
    // овц- с е
    it('should detect овцееб', () => {
      expect(checker.containsProfanity('овцееб')).toBe(true);
    });

    it('should detect авцееб', () => {
      expect(checker.containsProfanity('авцееб')).toBe(true);
    });

    // овц- с ё
    it('should detect овцеёб', () => {
      expect(checker.containsProfanity('овцеёб')).toBe(true);
    });

    // осл- с е
    it('should detect ослоеб', () => {
      expect(checker.containsProfanity('ослоеб')).toBe(true);
    });

    it('should detect аслоеб', () => {
      expect(checker.containsProfanity('аслоеб')).toBe(true);
    });

    it('should detect аслаеб', () => {
      expect(checker.containsProfanity('аслаеб')).toBe(true);
    });

    // осл- с ё
    it('should detect ослоёб', () => {
      expect(checker.containsProfanity('ослоёб')).toBe(true);
    });

    // козл- с е
    it('should detect козлоеб', () => {
      expect(checker.containsProfanity('козлоеб')).toBe(true);
    });

    it('should detect козлаеб', () => {
      expect(checker.containsProfanity('козлаеб')).toBe(true);
    });

    // козл- с ё
    it('should detect козлоёб', () => {
      expect(checker.containsProfanity('козлоёб')).toBe(true);
    });

    it('should detect козлаёб', () => {
      expect(checker.containsProfanity('козлаёб')).toBe(true);
    });

    // казл- с е
    it('should detect казлоеб', () => {
      expect(checker.containsProfanity('казлоеб')).toBe(true);
    });

    it('should detect казлаеб', () => {
      expect(checker.containsProfanity('казлаеб')).toBe(true);
    });

    // казл- с ё
    it('should detect казлоёб', () => {
      expect(checker.containsProfanity('казлоёб')).toBe(true);
    });

    it('should detect казлаёб', () => {
      expect(checker.containsProfanity('казлаёб')).toBe(true);
    });

    it('should detect авциеб', () => {
      expect(checker.containsProfanity('авциеб')).toBe(true);
    });
  });

  describe('хер compound profanity', () => {
    it('should detect херосос', () => {
      expect(checker.containsProfanity('херосос')).toBe(true);
    });

    it('should detect херососка', () => {
      expect(checker.containsProfanity('херососка')).toBe(true);
    });

    it('should detect херасос', () => {
      expect(checker.containsProfanity('херасос')).toBe(true);
    });

    it('should detect херасоска', () => {
      expect(checker.containsProfanity('херасоска')).toBe(true);
    });
  });

  describe('хуи- derivatives', () => {
    it('should detect хуиверт', () => {
      expect(checker.containsProfanity('хуиверт')).toBe(true);
    });

    it('should detect хуйсгоры', () => {
      expect(checker.containsProfanity('хуйсгоры')).toBe(true);
    });
  });

  describe('хуесо standalone', () => {
    it('should detect хуесо', () => {
      expect(checker.containsProfanity('хуесо')).toBe(true);
    });
  });

  // ===== манда/монда =====

  describe('манда/монда derivatives', () => {
    it('should detect манда', () => {
      expect(checker.containsProfanity('манда')).toBe(true);
    });

    it('should detect мандавошка', () => {
      expect(checker.containsProfanity('мандавошка')).toBe(true);
    });

    it('should detect мандовошка', () => {
      expect(checker.containsProfanity('мандовошка')).toBe(true);
    });

    it('should detect мондавошка', () => {
      expect(checker.containsProfanity('мондавошка')).toBe(true);
    });

    it('should detect мондовошка', () => {
      expect(checker.containsProfanity('мондовошка')).toBe(true);
    });

    it('should detect мандолиз', () => {
      expect(checker.containsProfanity('мандолиз')).toBe(true);
    });

    it('should detect мондализ', () => {
      expect(checker.containsProfanity('мондализ')).toBe(true);
    });

    it('should NOT flag мандарин', () => {
      expect(checker.containsProfanity('мандарин')).toBe(false);
    });

    it('should NOT flag мандат', () => {
      expect(checker.containsProfanity('мандат')).toBe(false);
    });
  });

  // ===== Digit substitution (0 for о) =====

  describe('obfuscation: digit substitution', () => {
    it('should detect хуев0й (0 for о)', () => {
      expect(checker.containsProfanity('хуев0й')).toBe(true);
    });

    it('should detect г0вно (0 for о)', () => {
      expect(checker.containsProfanity('г0вно')).toBe(true);
    });

    it('should detect пид0р (0 for о)', () => {
      expect(checker.containsProfanity('пид0р')).toBe(true);
    });

    it('should detect муд4к (4 for а)', () => {
      expect(checker.containsProfanity('муд4к')).toBe(true);
    });

    it('should detect 6лять (6 for б)', () => {
      expect(checker.containsProfanity('6лять')).toBe(true);
    });

    it('should detect ху3вый (3 for е/з)', () => {
      expect(checker.containsProfanity('ху3вый')).toBe(true);
    });

    it('should NOT flag clean text with digits', () => {
      expect(checker.containsProfanity('организация 123')).toBe(false);
    });

    it('should NOT flag year', () => {
      expect(checker.containsProfanity('2026')).toBe(false);
    });
  });

  // ===== False positive checks =====

  describe('false positives: legitimate words must NOT be flagged', () => {
    // пид infix
    it('should NOT flag пиджак', () => {
      expect(checker.containsProfanity('пиджак')).toBe(false);
    });

    it('should NOT flag эпидемия', () => {
      expect(checker.containsProfanity('эпидемия')).toBe(false);
    });

    it('should NOT flag педиатр', () => {
      expect(checker.containsProfanity('педиатр')).toBe(false);
    });

    it('should NOT flag педикюр', () => {
      expect(checker.containsProfanity('педикюр')).toBe(false);
    });

    // ебен infix
    it('should NOT flag ребенок', () => {
      expect(checker.containsProfanity('ребенок')).toBe(false);
    });

    it('should NOT flag жеребенок', () => {
      expect(checker.containsProfanity('жеребенок')).toBe(false);
    });

    // ебат infix
    it('should NOT flag хлебать', () => {
      expect(checker.containsProfanity('хлебать')).toBe(false);
    });

    // анал custom blocked
    it('should NOT flag анализ', () => {
      expect(checker.containsProfanity('анализ')).toBe(false);
    });

    it('should NOT flag анналы', () => {
      expect(checker.containsProfanity('анналы')).toBe(false);
    });

    it('should NOT flag аналитика', () => {
      expect(checker.containsProfanity('аналитика')).toBe(false);
    });

    it('should NOT flag аналог', () => {
      expect(checker.containsProfanity('аналог')).toBe(false);
    });

    // трах custom blocked
    it('should NOT flag трахея', () => {
      expect(checker.containsProfanity('трахея')).toBe(false);
    });

    // хер custom blocked
    it('should NOT flag Херсон', () => {
      expect(checker.containsProfanity('Херсон')).toBe(false);
    });

    it('should NOT flag херувим', () => {
      expect(checker.containsProfanity('херувим')).toBe(false);
    });

    // манда custom blocked
    it('should NOT flag мандарин', () => {
      expect(checker.containsProfanity('мандарин')).toBe(false);
    });

    it('should NOT flag мандат', () => {
      expect(checker.containsProfanity('мандат')).toBe(false);
    });

    // дурак excluded
    it('should NOT flag дурак', () => {
      expect(checker.containsProfanity('дурак')).toBe(false);
    });

    // конч- family
    it('should NOT flag кончить', () => {
      expect(checker.containsProfanity('кончить')).toBe(false);
    });

    it('should NOT flag закончить', () => {
      expect(checker.containsProfanity('закончить')).toBe(false);
    });

    it('should NOT flag окончание', () => {
      expect(checker.containsProfanity('окончание')).toBe(false);
    });

    // наркотик
    it('should NOT flag наркотик', () => {
      expect(checker.containsProfanity('наркотик')).toBe(false);
    });

    // калечить
    it('should NOT flag калечить', () => {
      expect(checker.containsProfanity('калечить')).toBe(false);
    });

    it('should NOT flag покалечить', () => {
      expect(checker.containsProfanity('покалечить')).toBe(false);
    });

    // болванка
    it('should NOT flag болванка', () => {
      expect(checker.containsProfanity('болванка')).toBe(false);
    });

    // уродливый
    it('should NOT flag уродливый', () => {
      expect(checker.containsProfanity('уродливый')).toBe(false);
    });

    // сдохнуть
    it('should NOT flag сдохла', () => {
      expect(checker.containsProfanity('сдохла')).toBe(false);
    });

    // бухгалтер
    it('should NOT flag бухгалтер', () => {
      expect(checker.containsProfanity('бухгалтер')).toBe(false);
    });

    // кабинет (contains минет!)
    it('should NOT flag кабинет', () => {
      expect(checker.containsProfanity('кабинет')).toBe(false);
    });

    // рецепт (contains епт!)
    it('should NOT flag рецепт', () => {
      expect(checker.containsProfanity('рецепт')).toBe(false);
    });

    // идиома (starts with идиот stem prefix)
    it('should NOT flag идиома', () => {
      expect(checker.containsProfanity('идиома')).toBe(false);
    });

    // товар (NOT тварь)
    it('should NOT flag товар', () => {
      expect(checker.containsProfanity('товар')).toBe(false);
    });

    it('should NOT flag товарищ', () => {
      expect(checker.containsProfanity('товарищ')).toBe(false);
    });

    // поцелуй (contains целк... no, целу is different)
    it('should NOT flag поцелуй', () => {
      expect(checker.containsProfanity('поцелуй')).toBe(false);
    });

    // рептилия
    it('should NOT flag рептилия', () => {
      expect(checker.containsProfanity('рептилия')).toBe(false);
    });

    // победа, лебедь, требовать (contain еб)
    it('should NOT flag победа', () => {
      expect(checker.containsProfanity('победа')).toBe(false);
    });

    it('should NOT flag лебедь', () => {
      expect(checker.containsProfanity('лебедь')).toBe(false);
    });

    it('should NOT flag требовать', () => {
      expect(checker.containsProfanity('требовать')).toBe(false);
    });

    it('should NOT flag потребность', () => {
      expect(checker.containsProfanity('потребность')).toBe(false);
    });

    it('should NOT flag небо', () => {
      expect(checker.containsProfanity('небо')).toBe(false);
    });

    it('should NOT flag хлеб', () => {
      expect(checker.containsProfanity('хлеб')).toBe(false);
    });

    it('should NOT flag ребята', () => {
      expect(checker.containsProfanity('ребята')).toBe(false);
    });

    // пожар (contains жоп? No — жоп infix, пожар contains ожа not жоп)
    it('should NOT flag пожар', () => {
      expect(checker.containsProfanity('пожар')).toBe(false);
    });

    // себя, тебя
    it('should NOT flag себя', () => {
      expect(checker.containsProfanity('себя')).toBe(false);
    });

    it('should NOT flag тебя', () => {
      expect(checker.containsProfanity('тебя')).toBe(false);
    });

    // дебит/дебиторский (starts with дебил stem? дебит starts with деби, not дебил)
    it('should NOT flag дебит', () => {
      expect(checker.containsProfanity('дебит')).toBe(false);
    });

    it('should NOT flag дебиторский', () => {
      expect(checker.containsProfanity('дебиторский')).toBe(false);
    });
  });

  // ===== Extended word list from manual testing =====

  describe('extended word list', () => {
    // special char substitution
    it('should detect Г@ндон', () => {
      expect(checker.containsProfanity('Г@ндон')).toBe(true);
    });

    it('should detect П#дор', () => {
      expect(checker.containsProfanity('П#дор')).toBe(true);
    });

    it('should detect Еб$ть', () => {
      expect(checker.containsProfanity('Еб$ть')).toBe(true);
    });

    it('should detect Пидо₽осня', () => {
      expect(checker.containsProfanity('Пидо₽осня')).toBe(true);
    });

    it('should detect $ука', () => {
      expect(checker.containsProfanity('$ука')).toBe(true);
    });

    it('should detect Гандо#', () => {
      expect(checker.containsProfanity('Гандо#')).toBe(true);
    });

    it('should detect Пи£да', () => {
      expect(checker.containsProfanity('Пи£да')).toBe(true);
    });

    it('should detect Ху€$о$', () => {
      expect(checker.containsProfanity('Ху€$о$')).toBe(true);
    });

    // stems/infixes needed
    it('should detect членсоска', () => {
      expect(checker.containsProfanity('членсоска')).toBe(true);
    });

    it('should detect Писька', () => {
      expect(checker.containsProfanity('Писька')).toBe(true);
    });

    it('should detect Писюн', () => {
      expect(checker.containsProfanity('Писюн')).toBe(true);
    });

    it('should detect Ебень', () => {
      expect(checker.containsProfanity('Ебень')).toBe(true);
    });

    it('should detect Пидр', () => {
      expect(checker.containsProfanity('Пидр')).toBe(true);
    });

    it('should detect педик', () => {
      expect(checker.containsProfanity('педик')).toBe(true);
    });

    it('should detect педике (предложный)', () => {
      expect(checker.containsProfanity('педике')).toBe(true);
    });

    it('should detect педиках (предложный мн.ч.)', () => {
      expect(checker.containsProfanity('педиках')).toBe(true);
    });

    it('should detect Конча', () => {
      expect(checker.containsProfanity('Конча')).toBe(true);
    });

    it('should detect Конченый', () => {
      expect(checker.containsProfanity('Конченый')).toBe(true);
    });

    it('should detect Ублюдок', () => {
      expect(checker.containsProfanity('Ублюдок')).toBe(true);
    });

    it('should detect Тварь', () => {
      expect(checker.containsProfanity('Тварь')).toBe(true);
    });

    it('should detect Утырок', () => {
      expect(checker.containsProfanity('Утырок')).toBe(true);
    });

    it('should detect Чмырь', () => {
      expect(checker.containsProfanity('Чмырь')).toBe(true);
    });

    it('should detect Долбаный', () => {
      expect(checker.containsProfanity('Долбаный')).toBe(true);
    });

    it('should detect Долбанный', () => {
      expect(checker.containsProfanity('Долбанный')).toBe(true);
    });

    it('should detect Сиськи', () => {
      expect(checker.containsProfanity('Сиськи')).toBe(true);
    });

    it('should detect Сиськa', () => {
      expect(checker.containsProfanity('Сиськa')).toBe(true);
    });

    it('should detect Сисечки', () => {
      expect(checker.containsProfanity('Сисечки')).toBe(true);
    });

    it('should detect Сисечка', () => {
      expect(checker.containsProfanity('Сисечка')).toBe(true);
    });

    it('should detect Болван', () => {
      expect(checker.containsProfanity('Болван')).toBe(true);
    });

    it('should detect Идиот', () => {
      expect(checker.containsProfanity('Идиот')).toBe(true);
    });

    it('should detect Сволочь', () => {
      expect(checker.containsProfanity('Сволочь')).toBe(true);
    });

    it('should detect Гавно', () => {
      expect(checker.containsProfanity('Гавно')).toBe(true);
    });

    it('should detect Анал', () => {
      expect(checker.containsProfanity('Анал')).toBe(true);
    });

    it('should detect Вонючка', () => {
      expect(checker.containsProfanity('Вонючка')).toBe(true);
    });

    it('should detect ванючка', () => {
      expect(checker.containsProfanity('ванючка')).toBe(true);
    });

    it('should detect Дебил', () => {
      expect(checker.containsProfanity('Дебил')).toBe(true);
    });

    it('should detect Бухло', () => {
      expect(checker.containsProfanity('Бухло')).toBe(true);
    });

    it('should detect Какашка', () => {
      expect(checker.containsProfanity('Какашка')).toBe(true);
    });

    it('should detect Задница', () => {
      expect(checker.containsProfanity('Задница')).toBe(true);
    });

    it('should detect Дегенерат', () => {
      expect(checker.containsProfanity('Дегенерат')).toBe(true);
    });

    it('should detect Еблан', () => {
      expect(checker.containsProfanity('Еблан')).toBe(true);
    });

    it('should detect Сдохни', () => {
      expect(checker.containsProfanity('Сдохни')).toBe(true);
    });

    it('should detect Наркота', () => {
      expect(checker.containsProfanity('Наркота')).toBe(true);
    });

    it('should detect Дура', () => {
      expect(checker.containsProfanity('Дура')).toBe(true);
    });

    it('should detect Дурь', () => {
      expect(checker.containsProfanity('Дурь')).toBe(true);
    });

    it('should detect Целка', () => {
      expect(checker.containsProfanity('Целка')).toBe(true);
    });

    it('should detect Тупица', () => {
      expect(checker.containsProfanity('Тупица')).toBe(true);
    });

    it('should detect Урод', () => {
      expect(checker.containsProfanity('Урод')).toBe(true);
    });

    it('should detect уродина', () => {
      expect(checker.containsProfanity('уродина')).toBe(true);
    });

    it('should detect Шпехаться', () => {
      expect(checker.containsProfanity('Шпехаться')).toBe(true);
    });

    it('should detect Перепих', () => {
      expect(checker.containsProfanity('Перепих')).toBe(true);
    });

    it('should detect Калич', () => {
      expect(checker.containsProfanity('Калич')).toBe(true);
    });

    it('should detect калеч', () => {
      expect(checker.containsProfanity('калеч')).toBe(true);
    });

    it('should detect Косожопый', () => {
      expect(checker.containsProfanity('Косожопый')).toBe(true);
    });

    it('should detect Жирдяй', () => {
      expect(checker.containsProfanity('Жирдяй')).toBe(true);
    });

    it('should detect Долбаеб', () => {
      expect(checker.containsProfanity('Долбаеб')).toBe(true);
    });

    it('should detect Фуфло', () => {
      expect(checker.containsProfanity('Фуфло')).toBe(true);
    });

    it('should detect Трахать', () => {
      expect(checker.containsProfanity('Трахать')).toBe(true);
    });

    it('should detect трах', () => {
      expect(checker.containsProfanity('трах')).toBe(true);
    });

    // multi-word phrases
    it('should detect Твою мать', () => {
      expect(checker.containsProfanity('Твою мать')).toBe(true);
    });

    it('should detect твоюмать', () => {
      expect(checker.containsProfanity('твоюмать')).toBe(true);
    });

    it('should detect Твою ж мать', () => {
      expect(checker.containsProfanity('Твою ж мать')).toBe(true);
    });

    it('should detect твоюжмать', () => {
      expect(checker.containsProfanity('твоюжмать')).toBe(true);
    });
  });

  // ===== Obfuscation: Latin transliteration & mixed-script =====

  describe('obfuscation: Latin transliteration & mixed-script', () => {
    it.each([
      ['Xpen', 'хрен (X=х, p=р, e=е, n=н)'],
      ['Xren', 'хрен (X=х, r=р, e=е, n=н)'],
      ['Hren', 'хрен (H→х)'],
      ['Gandon', 'гандон (G=г, a=а, n=н, d=д)'],
      ['Handon', 'хандон (гандон variant)'],
      ['Coci', 'соси (C=с, o=о, c=с, i=и)'],
      ['Sosi', 'соси (S=с, o=о, s=с, i=и)'],
      ['Hui', 'хуй'],
      ['Hyi', 'хуй (H→х, y=у, i→и)'],
      ['Yeban', 'ебан/уебан'],
      ['Ueban', 'уебан'],
      ['blyad', 'блядь'],
      ["blyad'", 'блядь (apostrophe for ь)'],
      ['pizdabol', 'пиздабол (full translit)'],
      ['pizdobol', 'пиздобол (full translit)'],
      ['pezdabol', 'пездабол (full translit)'],
      ['pezdobol', 'пездобол (full translit)'],
      ['pezd0bol', 'пезд0бол (translit + digit)'],
      ['пи3добол', 'пиздобол (digit 3→е→з? no, 3→е)'],
      ['пe3добол', 'пезд (Latin e + digit 3)'],
      ['пи3дaбол', 'пиздабол (digit 3 + Latin a)'],
      ['пe3д@бол', 'пезд (Latin e + digit 3 + @)'],
      ['пйздабол', 'пиздабол (й used as и evasion)'],
      ['дро4', 'дроч (digit 4 as ч)'],
      ['6лятский', 'блятский (digit 6 as б)'],
      ['xuy', 'хуй'],
      ['хуj', 'хуй (Latin j for й)'],
      ['ган9он', 'гандон (digit 9 as д)'],
      ['Xer', 'хер (X=х, e=е, r=р)'],
      ['@nal', 'анал (@=а, n=н, l=л)'],
      ['Minet', 'минет (M=м, i=и, n=н, e=е, t=т)'],
      ['Пиsдюк', 'пиздюк (Latin s for з)'],
      ['Пиsда', 'пизда (Latin s for з)'],
      ['Пи$да', 'пизда ($ evasion, stripped to Пида)'],
      ['#опа', 'жопа (# for ж)'],
      ['Droчь', 'дрочь (Latin D=д, r=р, o=о)'],
      ['droчила', 'дрочила (Latin d=д, r=р, o=о)'],
      ['€блan', 'еблан (€=е, a=а, n=н)'],
      ['уебок', 'уебок (Cyrillic)'],
      ['уёбок', 'уёбок (ё variant)'],
      ['uebok', 'уебок (Latin)'],
      ['yebok', 'уебок (Latin, y=у)'],
    ])('should detect %s — %s', (word) => {
      expect(checker.containsProfanity(word)).toBe(true);
    });

    it('should NOT flag "hue" (English color term)', () => {
      expect(checker.containsProfanity('hue')).toBe(false);
    });
  });
});
