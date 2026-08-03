/**
 * The languages Scriba will translate into.
 *
 * A closed list rather than free text, for two reasons. The first is prompt
 * hygiene: "translate this into <whatever the user typed>" puts an unbounded
 * string into a system instruction, and the whole point of §5.10's narrow
 * surface is that we know what the prompt contains because we assembled it.
 *
 * The second is honesty about quality. These are languages a general model
 * handles well enough that a bilingual volunteer can correct a draft in a
 * couple of minutes. A language with thin training data produces output that
 * looks fluent and is wrong, which on a notice about somebody's housing rights
 * is worse than no translation at all — so it is better to offer nothing and
 * say why than to offer a plausible mistranslation.
 *
 * Adding one is a deliberate act. Ask whether a speaker of it can check the
 * output before it goes on a door.
 */

export interface Language {
  /** BCP 47, used for the `lang` attribute so screen readers switch voice. */
  code: string;
  /** In English, for the picker. */
  name: string;
  /** In the language itself, because that is who is reading the result. */
  endonym: string;
  /** Right-to-left scripts need the direction carried through to the markup. */
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'es', name: 'Spanish', endonym: 'Espanol' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', endonym: 'Jian ti zhong wen' },
  { code: 'vi', name: 'Vietnamese', endonym: 'Tieng Viet' },
  { code: 'tl', name: 'Tagalog', endonym: 'Tagalog' },
  { code: 'ar', name: 'Arabic', endonym: 'al-arabiyyah', rtl: true },
  { code: 'ko', name: 'Korean', endonym: 'Hangugeo' },
  { code: 'ru', name: 'Russian', endonym: 'Russkiy' },
  { code: 'ht', name: 'Haitian Creole', endonym: 'Kreyol ayisyen' },
  { code: 'pt', name: 'Portuguese', endonym: 'Portugues' },
  { code: 'fr', name: 'French', endonym: 'Francais' },
  { code: 'bn', name: 'Bengali', endonym: 'Bangla' },
  { code: 'so', name: 'Somali', endonym: 'Soomaali' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export const languageFor = (code: string) => LANGUAGES.find((l) => l.code === code);

/**
 * Shown with every translation, and not dismissible.
 *
 * A machine translation of "you do not have to open the door" that lands
 * slightly wrong is not a typo, it is advice that could cost somebody their
 * home. The product's job is to get a group 90% of the way in seconds so a
 * bilingual member spends two minutes rather than an hour — and to say plainly
 * that the two minutes are not optional.
 */
export const TRANSLATION_CAVEAT =
  'A machine drafted this. Before it goes on a door or into a text message, have someone who ' +
  'speaks the language read it — especially any sentence about rights, deadlines or money, ' +
  'where a small error is not a typo.';
