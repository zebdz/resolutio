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
      expect(checker.containsProfanity('xye вый')).toBe(true);
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
  });
});
