/**
 * Zodiac Derivation Utility — Indoles Module
 *
 * WHAT: Pure function deriving zodiac sign, element, and modality from month/day.
 * WHERE: Used client-side for instant preview; DB trigger is the source of truth.
 * WHY: Avoids round-trip to DB when displaying birthday-related context in forms.
 */

export interface ZodiacResult {
  sign: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
}

const ZODIAC_TABLE: Array<{
  sign: string;
  element: ZodiacResult['element'];
  modality: ZodiacResult['modality'];
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}> = [
  { sign: 'Capricorn', element: 'Earth', modality: 'Cardinal', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { sign: 'Aquarius',  element: 'Air',   modality: 'Fixed',    startMonth: 1,  startDay: 20, endMonth: 2, endDay: 18 },
  { sign: 'Pisces',    element: 'Water', modality: 'Mutable',  startMonth: 2,  startDay: 19, endMonth: 3, endDay: 20 },
  { sign: 'Aries',     element: 'Fire',  modality: 'Cardinal', startMonth: 3,  startDay: 21, endMonth: 4, endDay: 19 },
  { sign: 'Taurus',    element: 'Earth', modality: 'Fixed',    startMonth: 4,  startDay: 20, endMonth: 5, endDay: 20 },
  { sign: 'Gemini',    element: 'Air',   modality: 'Mutable',  startMonth: 5,  startDay: 21, endMonth: 6, endDay: 20 },
  { sign: 'Cancer',    element: 'Water', modality: 'Cardinal', startMonth: 6,  startDay: 21, endMonth: 7, endDay: 22 },
  { sign: 'Leo',       element: 'Fire',  modality: 'Fixed',    startMonth: 7,  startDay: 23, endMonth: 8, endDay: 22 },
  { sign: 'Virgo',     element: 'Earth', modality: 'Mutable',  startMonth: 8,  startDay: 23, endMonth: 9, endDay: 22 },
  { sign: 'Libra',     element: 'Air',   modality: 'Cardinal', startMonth: 9,  startDay: 23, endMonth: 10, endDay: 22 },
  { sign: 'Scorpio',   element: 'Water', modality: 'Fixed',    startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { sign: 'Sagittarius', element: 'Fire', modality: 'Mutable', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
];

/**
 * Derive zodiac sign, element, and modality from month and day.
 * Returns null if inputs are invalid.
 */
export function deriveZodiac(month: number, day: number): ZodiacResult | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  for (const entry of ZODIAC_TABLE) {
    // Handle Capricorn wrapping Dec→Jan
    if (entry.startMonth > entry.endMonth) {
      if (
        (month === entry.startMonth && day >= entry.startDay) ||
        (month === entry.endMonth && day <= entry.endDay)
      ) {
        return { sign: entry.sign, element: entry.element, modality: entry.modality };
      }
    } else {
      if (
        (month === entry.startMonth && day >= entry.startDay) ||
        (month === entry.endMonth && day <= entry.endDay) ||
        (month > entry.startMonth && month < entry.endMonth)
      ) {
        return { sign: entry.sign, element: entry.element, modality: entry.modality };
      }
    }
  }

  return null;
}

/**
 * Derive zodiac from a Date object.
 */
export function deriveZodiacFromDate(date: Date | null | undefined): ZodiacResult | null {
  if (!date) return null;
  return deriveZodiac(date.getMonth() + 1, date.getDate());
}

/**
 * Compute age in years from a date of birth string (YYYY-MM-DD).
 * Returns null if DOB is invalid or missing.
 */
export function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob + 'T00:00:00');
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}
