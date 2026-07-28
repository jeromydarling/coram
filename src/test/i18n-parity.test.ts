/**
 * i18n key parity tests.
 *
 * WHAT: Ensures every English key exists in Spanish and vice versa.
 * WHERE: src/i18n/locales/en/*.json vs src/i18n/locales/es/*.json
 * WHY: Prevents missing translations and orphan keys across locales.
 */
import { describe, it, expect } from 'vitest';
import { NAMESPACES } from '@/i18n/i18n';

// Import all English namespaces
import commonEn from '@/i18n/locales/en/common.json';
import navigationEn from '@/i18n/locales/en/navigation.json';
import dashboardEn from '@/i18n/locales/en/dashboard.json';
import relationshipsEn from '@/i18n/locales/en/relationships.json';
import eventsEn from '@/i18n/locales/en/events.json';
import volunteersEn from '@/i18n/locales/en/volunteers.json';
import provisionsEn from '@/i18n/locales/en/provisions.json';
import settingsEn from '@/i18n/locales/en/settings.json';
import marketingEn from '@/i18n/locales/en/marketing.json';
import operatorEn from '@/i18n/locales/en/operator.json';
import helpEn from '@/i18n/locales/en/help.json';
import narrativeEn from '@/i18n/locales/en/narrative.json';
import activitiesEn from '@/i18n/locales/en/activities.json';
import calendarEn from '@/i18n/locales/en/calendar.json';
import grantsEn from '@/i18n/locales/en/grants.json';
import intelligenceEn from '@/i18n/locales/en/intelligence.json';
import metrosEn from '@/i18n/locales/en/metros.json';
import reportsEn from '@/i18n/locales/en/reports.json';
import projectsEn from '@/i18n/locales/en/projects.json';

// Import all Spanish namespaces
import commonEs from '@/i18n/locales/es/common.json';
import navigationEs from '@/i18n/locales/es/navigation.json';
import dashboardEs from '@/i18n/locales/es/dashboard.json';
import relationshipsEs from '@/i18n/locales/es/relationships.json';
import eventsEs from '@/i18n/locales/es/events.json';
import volunteersEs from '@/i18n/locales/es/volunteers.json';
import provisionsEs from '@/i18n/locales/es/provisions.json';
import settingsEs from '@/i18n/locales/es/settings.json';
import marketingEs from '@/i18n/locales/es/marketing.json';
import operatorEs from '@/i18n/locales/es/operator.json';
import helpEs from '@/i18n/locales/es/help.json';
import narrativeEs from '@/i18n/locales/es/narrative.json';
import activitiesEs from '@/i18n/locales/es/activities.json';
import calendarEs from '@/i18n/locales/es/calendar.json';
import grantsEs from '@/i18n/locales/es/grants.json';
import intelligenceEs from '@/i18n/locales/es/intelligence.json';
import metrosEs from '@/i18n/locales/es/metros.json';
import reportsEs from '@/i18n/locales/es/reports.json';
import projectsEs from '@/i18n/locales/es/projects.json';

type NestedObj = Record<string, unknown>;

const enNamespaces: Record<string, NestedObj> = {
  common: commonEn, navigation: navigationEn, dashboard: dashboardEn,
  relationships: relationshipsEn, events: eventsEn, volunteers: volunteersEn,
  provisions: provisionsEn, settings: settingsEn, marketing: marketingEn,
  operator: operatorEn, help: helpEn, narrative: narrativeEn,
  activities: activitiesEn, calendar: calendarEn, grants: grantsEn,
  intelligence: intelligenceEn, metros: metrosEn, reports: reportsEn,
  projects: projectsEn,
};

const esNamespaces: Record<string, NestedObj> = {
  common: commonEs, navigation: navigationEs, dashboard: dashboardEs,
  relationships: relationshipsEs, events: eventsEs, volunteers: volunteersEs,
  provisions: provisionsEs, settings: settingsEs, marketing: marketingEs,
  operator: operatorEs, help: helpEs, narrative: narrativeEs,
  activities: activitiesEs, calendar: calendarEs, grants: grantsEs,
  intelligence: intelligenceEs, metros: metrosEs, reports: reportsEs,
  projects: projectsEs,
};

/** Flatten a nested JSON object into dot-path keys */
function flattenKeys(obj: NestedObj, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as NestedObj, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Get value at a dot-path */
function getAtPath(obj: NestedObj, path: string): unknown {
  return path.split('.').reduce((acc: any, key) => acc?.[key], obj);
}

/** Extract interpolation placeholders like {{name}} */
function extractPlaceholders(str: string): string[] {
  const matches = str.match(/\{\{(\w+)\}\}/g);
  return matches ? matches.sort() : [];
}

describe('i18n namespace file parity', () => {
  it('English and Spanish have the same namespace files', () => {
    const enKeys = Object.keys(enNamespaces).sort();
    const esKeys = Object.keys(esNamespaces).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it('all NAMESPACES are represented', () => {
    for (const ns of NAMESPACES) {
      expect(enNamespaces[ns], `Missing EN namespace: ${ns}`).toBeDefined();
      expect(esNamespaces[ns], `Missing ES namespace: ${ns}`).toBeDefined();
    }
  });
});

describe.each(NAMESPACES)('i18n parity — %s', (ns) => {
  const enObj = enNamespaces[ns] ?? {};
  const esObj = esNamespaces[ns] ?? {};
  const enKeys = flattenKeys(enObj);
  const esKeys = flattenKeys(esObj);

  it('every English key exists in Spanish', () => {
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
    expect(missingInEs, `Keys in EN but missing in ES (${ns})`).toEqual([]);
  });

  it('no orphan keys in Spanish (every ES key exists in EN)', () => {
    const orphansInEs = esKeys.filter((k) => !enKeys.includes(k));
    expect(orphansInEs, `Orphan keys in ES not in EN (${ns})`).toEqual([]);
  });

  it('no empty string values in English', () => {
    const empties = enKeys.filter((k) => {
      const val = getAtPath(enObj, k);
      return typeof val === 'string' && val.trim() === '';
    });
    expect(empties, `Empty EN values in ${ns}`).toEqual([]);
  });

  it('no empty string values in Spanish', () => {
    const empties = esKeys.filter((k) => {
      const val = getAtPath(esObj, k);
      return typeof val === 'string' && val.trim() === '';
    });
    expect(empties, `Empty ES values in ${ns}`).toEqual([]);
  });

  it('interpolation placeholders match between EN and ES', () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enVal = getAtPath(enObj, key);
      const esVal = getAtPath(esObj, key);
      if (typeof enVal === 'string' && typeof esVal === 'string') {
        const enPlaceholders = extractPlaceholders(enVal);
        const esPlaceholders = extractPlaceholders(esVal);
        if (JSON.stringify(enPlaceholders) !== JSON.stringify(esPlaceholders)) {
          mismatches.push(`${key}: EN=${enPlaceholders} ES=${esPlaceholders}`);
        }
      }
    }
    expect(mismatches, `Placeholder mismatches in ${ns}`).toEqual([]);
  });
});
