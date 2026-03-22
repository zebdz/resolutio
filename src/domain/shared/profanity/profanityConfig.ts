// Common Russian derived forms missing from leo-profanity's dictionary.
// The library already covers: хуй/хуе/хуё, бля/блядь, еба/ебать, пизд, сук, долбоёб.
// е-variants of ё-forms (хуево, ебнуть, долбоеб, etc.) are auto-generated
// in LeoProfanityChecker constructor — no need to list them here.
// Most Russian morphology is handled by PROFANITY_STEMS (stem matching).
// This list only contains words NOT covered by stems or the library.
export const PROFANITY_CUSTOM_BLOCKED: string[] = [
  'хер', // standalone; can't use as stem (would catch херсон, херувим, херес)

  // манда/монда standalone; can't use as stem (would catch мандарин, мандат)
  'манда',
  'манды',
  'манде',
  'манду',
  'мандой',
  'монда',
  'монды',
  'монде',
  'монду',
  'мондой',

  // анал — can't use as stem (would catch анализ)
  'анал',
  'анала',
  'аналу',
  'аналом',
  'анале',

  // трах — can't use as stem (would catch трахея)
  'трах',

  // конча/конченый — can't use конч- stem (would catch кончить, кончилось)
  'конча',
  'кончи',
  'конченый',
  'конченая',
  'конченое',
  'конченые',

  // дура/дурь/дуралей — can't use дур- stem (would catch дурак which user excluded)
  'дура',
  'дуры',
  'дуре',
  'дуру',
  'дурой',
  'дурочка',
  'дурочки',
  'дурь',
  'дури',
  'дуралей',
  'дуралея',
  'дуралею',

  // урод/уродина — can't use урод- stem (уродливый is sometimes neutral)
  'урод',
  'урода',
  'уроду',
  'уродом',
  'уроде',
  'уроды',
  'уродов',
  'уродина',
  'уродины',
  'уродке',

  // наркота — can't use наркот- stem (наркотик is legitimate)
  'наркота',
  'наркоты',
  'наркоте',
  'наркоту',
  'наркотой',

  // сдохни — can't use сдохн- stem (сдохла/сдохнуть used neutrally: "батарейка сдохла")
  'сдохни',
  'сдохните',

  // болван — can't use as stem (болванка = blank/dummy in metalworking)
  'болван',
  'болвана',
  'болвану',
  'болваном',
  'болване',
  'болваны',
  'болванов',

  // калич/калеч — can't use as stem (калечить = to maim, legitimate word)
  'калич',
  'калеч',

  // педик — can't use as stem (would catch педикюр)
  'педик',
  'педика',
  'педику',
  'педиком',
  'педике',
  'педики',
  'педиков',
  'педикам',
  'педиками',
  'педиках',

  // stripped forms from symbol-obfuscated words (П#дор→Пдор, Пи£да→Пида)
  'пдор',
  'пида', // stripped from Пи£да

  // words that can't be infixes (false positive risk)
  'ебень', // can't use ебен infix (ребенок, жеребенок)

  // Cyrillic words not in library or stems
  'хрен', // standalone; хренов- derivatives via stem
  'соси', // imperative singular; can't use stem (сосиска)
  'сосите', // imperative plural

  // Latin transliterations of common Russian profanity (evasion via Latin script)
  'hui',
  'hyi',
  'huy',
  'xuy', // хуй
  'hren', // хрен
  'xren',
  'xpen', // хрен (x=х, p=р)
  'gandon', // гандон
  'handon', // гандон variant
  'sosi',
  'coci', // соси
  'yeban',
  'ueban', // (у)ебан
  'xer', // хер
  'minet', // минет
  'uebok',
  'yebok', // уебок
];

// Profane stems for Russian morphology matching.
// Any word starting with one of these stems is considered profane.
// This catches all declensions/conjugations without enumerating every form.
// Stems are chosen to be long enough to avoid false positives on legitimate words.
export const PROFANITY_STEMS: string[] = [
  // NOTE: all stems are checked against ё→е normalized text, so only е-forms needed here.
  // ё-forms are handled by the library or by ё→е normalization + е-stems.

  // NOTE: хуй/хуе/хуи moved to PROFANITY_INFIXES — they're safe as substrings
  // and need to catch prefixed forms (аааахуеть, нахуярить, etc.)

  // хер derivatives (standalone 'хер' is in CUSTOM_BLOCKED — too short for stem)
  'херов', // херово, херовый, херовая, херовой, херовому...
  'херн', // херня, херни, херне, херню, херней...
  'херосос', // херосос, херососка...
  'херасос', // херасос, херасоска...

  // мудак
  'мудак', // мудак, мудака, мудаком, мудаки, мудаков...
  'мудач', // мудачье, мудачок...
  'мудил', // мудила, мудило...

  // гандон/гондон (shortened to catch stripped forms like Гандо#→Гандо)
  'гандо', // гандон, гандона, гандоном, гандонка, гандо (stripped)...
  'гондо', // гондон, гондона, гондоном, гондонка...

  // шлюх
  'шлюх', // шлюха, шлюхи, шлюхой, шлюхам...

  // пидор/пидар/пидер/пидир + педор/педар/педер/педир (all misspellings)
  'пидор', // пидор, пидора, пидором, пидорас, пидорами...
  'пидар', // пидар, пидара, пидары...
  'пидер', // пидераст...
  'пидир', // пидираст...
  'пидр', // пидр (shortened slang)
  'педор', // педорас, педораст...
  'педар', // педарас, педараст...
  'педер', // педераст...
  'педир', // педираст...

  // говн/гавн
  'говн', // говно, говна, говном, говнюк, говнище, говняный...
  'гавн', // гавно (misspelling of говно)...

  // дроч
  'дроч', // дрочить, дрочит, дрочила, дрочу...

  // срат/срак/сран
  'срат', // срать, срал, срала, срали...
  'срак', // срака, сраки, сраку, сракой...
  'сран', // срань

  // залуп/золуп
  'залуп', // залупа, залупы, залупу, залупой...
  'золуп', // золупа, золупы, золупу...

  // минет/миньет/миннет
  'минет', // минет, минета, минету, минетом...
  'миньет', // миньет, миньета...
  'миннет', // миннет, миннета...

  // членосос/членсос
  'членосос', // членосос, членососка...
  'членсос', // членсоска (misspelling)...

  // манда/монда compounds (can't use 'манд'/'манда' — would flag мандарин, мандат)
  'мандав', // мандавошка...
  'мандов', // мандовошка...
  'мандол', // мандолиз...
  'мондав', // мондавошка...
  'мондов', // мондовошка...
  'мондал', // мондализ...

  // епт (ёпт removed — dead; library catches ёпт directly, ё→е normalization + this stem catches епт)
  'епт', // епт

  // пизд- (stem for words starting with пизд)
  'пизд', // пизда, пиздец, пиздас, пиздос, пиздолиз, пиздалис...

  // пезд- (misspelling of пизд-)
  'пезд', // пезда, пездализ, пездолиз, пездолис, пездалис...

  // еб- prefixed/derived
  'ебан', // ебан, ебаный, ебанат...
  'уеб', // уебок, уебать, уебу, уебище... (no legitimate words start with уеб)
  'ебоб', // ебобо...

  // долбое/далбое/долбан/долбае
  'долбое', // долбоеб (also auto-generated from ё, but stem catches долбое*)
  'далбое', // далбоеб (misspelling)
  // NOTE: далбоё removed — dead (stems checked on ё→е normalized text; далбое covers it)
  'долбан', // долбаный, долбанный...
  'долбае', // долбаеб...

  // *еб compound words (animal + еб)
  'овцееб', // овцоёб written with е
  'авцееб', // misspelling
  'авциеб', // misspelling
  'ослоеб', // ослоёб written с е
  'аслоеб', // misspelling
  'аслаеб', // misspelling
  'козлоеб', // козлоёб written с е
  'козлаеб', // misspelling
  'казлоеб', // misspelling
  'казлаеб', // misspelling
  // NOTE: ё-variants (овцеёб, ослоёб, козлоёб, etc.) removed — dead code.
  // Stems are checked on ё→е normalized text; е-variants above cover them.

  // бляд/блят (блядь, бляди, блядский, блядство, блятский...)
  'бляд',
  'блят', // phonetic variant: блятский, блятская...

  // хрен derivatives (standalone 'хрен' is in CUSTOM_BLOCKED — too short for stem)
  'хренов', // хреновый, хреново, хреновая, хреновину...

  // хандон (variant of гандон; no legitimate words start with хандо)
  'хандо', // хандон, хандона, хандоном...

  // Extended insult stems (no legitimate words start with these)
  'сволоч', // сволочь, сволочи, сволочей...
  'дебил', // дебил, дебила, дебильный...
  'тупиц', // тупица, тупицы...
  'ублюд', // ублюдок, ублюдки...
  'твар', // тварь, твари, тварей... (no legitimate words start with твар-)
  'утыр', // утырок, утырка...
  'чмыр', // чмырь, чмыря...
  'дегенерат', // дегенерат, дегенерата...
  'целк', // целка, целки...
  'бухл', // бухло, бухлишко...
  'задниц', // задница, задницы...
  'какашк', // какашка, какашки...
  'вонючк', // вонючка, вонючки...
  'ванючк', // ванючка (misspelling)...
  'фуфл', // фуфло, фуфлыжник...
  'идиот', // идиот, идиотка, идиотизм...
  'жирд', // жирдяй, жирдяя...
  'сиськ', // сиськи, сиськa...
  'сисечк', // сисечки, сисечка...
  'письк', // писька, письки...
  'писюн', // писюн, писюна...
  'перепих', // перепих, перепиха...
  'шпехат', // шпехаться...
  'косожоп', // косожопый...
];

// Profane infixes — checked as substrings within words.
// Catches all prefixed forms (до-, на-, за-, от-, рас-, рос-, при-, по-, ис-, в-).
// Only roots that don't appear as substrings in legitimate Russian words.
export const PROFANITY_INFIXES: string[] = [
  // хуй/хуе/хуи — safe as substrings, catches all prefixed forms
  'хуй', // нахуй, хуйня, хуйсгоры, нахуярить...
  'хуе', // хуеть, аааахуеть, хуевый, охуеть, хуеплет, хуесос...
  'хуи', // хуиверт, охуительный, ахуительный...
  'хуё', // хуёво, охуённый...

  'пизд', // допиздел, напиздел, отпиздил, распиздяй, роспиздня...
  'пезд', // misspelling variant
  'ебан', // уебан, заебаный...
  'еблан', // еблан, ебланы...
  // NOTE: ебен removed — false positive on ребенок, жеребенок
  'ибан', // ибануть, ибанутый (misspelling of ебан)...
  'ибал', // разъибал, абъибал (misspelling of ебал)...
  // NOTE: ебат removed — false positive on хлебать. Library covers заебать/проебать/наебать.
  'доебат', // доебать, доебаться (not in library)
  'ебал', // заебал, проебал, наебал, доебал...
  'ебаш', // заебашить, наебашить...
  'ебас', // ебасить...
  'ебос', // ебос...
  'ёбну', // ёбнуть — and prefixed: долбоёбнуть...
  'ебну', // ебнуть (е-variant)
  'ебон', // ебонуть, ебонутый, ебонутая...
  'выеб', // выебу, выебать, вротвыебу...
  'ебт', // catches stripped Еб$ть→Ебть ($ used as letter replacement)
  'жоп', // жопа, косожопый, кривожопый... (moved from stems — infix catches prefixed forms)
  // NOTE: пид removed — false positive on пиджак, эпидемия. Stems пидор/пидар/пидр cover it.
  'трахат', // трахать (safe: трахея doesn't contain трахат)
  'трахну', // трахнуть, трахнул...
];

// Profane phrases — checked against the full collapsed text.
// Catches multi-word expressions.
export const PROFANITY_PHRASES: string[] = [
  'твоюмать',
  'твоюжмать',
  // # used as ж replacement (can't add #→ж to char subs: "#опрос" false positive)
  '#опа',
  '#опу',
  '#опе',
  '#опой',
  '#опы',
];

// False positives to allow
export const PROFANITY_WHITELISTED: string[] = [];
