/**
 * schemaDriftGuard — Adapter test helpers for schema drift resilience.
 *
 * WHAT: Shared utilities for testing connector adapters against extra fields, renames, and nulls.
 * WHERE: Used in connector fixture tests (Vitest + Demo Lab runner).
 * WHY: Catches vendor API response changes early without live credentials.
 */

export interface DriftWarning {
  code: 'SCHEMA_DRIFT' | 'FIELD_RENAMED_OR_MISSING' | 'NULL_NESTED';
  path: string;
  message: string;
}

export interface AdapterResult<T = Record<string, unknown>> {
  data: T[];
  warnings: DriftWarning[];
}

/**
 * Strip unknown keys from a record, returning only those in allowedKeys.
 * Records any extra keys as SCHEMA_DRIFT warnings.
 */
export function filterExtraFields<T extends Record<string, unknown>>(
  record: Record<string, unknown>,
  allowedKeys: string[],
  entityPath: string,
): { cleaned: Partial<T>; warnings: DriftWarning[] } {
  const warnings: DriftWarning[] = [];
  const cleaned: Record<string, unknown> = {};
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(record)) {
    if (allowed.has(key)) {
      cleaned[key] = record[key];
    } else {
      warnings.push({
        code: 'SCHEMA_DRIFT',
        path: `${entityPath}.${key}`,
        message: `Unknown field "${key}" — ignored safely`,
      });
    }
  }

  return { cleaned: cleaned as Partial<T>, warnings };
}

/**
 * Safely access a nested field with fallback.
 * Returns a warning if the expected field is missing but an alternative exists.
 */
export function safeField(
  record: Record<string, unknown>,
  primary: string,
  fallbacks: string[],
  entityPath: string,
): { value: unknown; warning?: DriftWarning } {
  if (record[primary] !== undefined && record[primary] !== null) {
    return { value: record[primary] };
  }

  for (const alt of fallbacks) {
    if (record[alt] !== undefined && record[alt] !== null) {
      return {
        value: record[alt],
        warning: {
          code: 'FIELD_RENAMED_OR_MISSING',
          path: `${entityPath}.${primary}`,
          message: `Expected "${primary}", found "${alt}" instead — using fallback`,
        },
      };
    }
  }

  return {
    value: null,
    warning: {
      code: 'FIELD_RENAMED_OR_MISSING',
      path: `${entityPath}.${primary}`,
      message: `Field "${primary}" missing with no known fallback`,
    },
  };
}

/**
 * Guard against null/missing nested objects.
 */
export function safeNested<T>(
  record: Record<string, unknown>,
  field: string,
  entityPath: string,
): { value: T | null; warning?: DriftWarning } {
  const val = record[field];
  if (val === undefined || val === null) {
    return {
      value: null,
      warning: {
        code: 'NULL_NESTED',
        path: `${entityPath}.${field}`,
        message: `Nested object "${field}" is null or missing — using blank`,
      },
    };
  }
  return { value: val as T };
}

/**
 * Coverage mode labels for connector confidence display.
 */
export type ConnectorCoverageMode = 'A' | 'B' | 'C';

export const COVERAGE_MODE_LABELS: Record<ConnectorCoverageMode, { label: string; description: string }> = {
  A: {
    label: 'Fixture-Verified Mapping',
    description: 'Mapping and normalization tested with deterministic fixtures.',
  },
  B: {
    label: 'Edge-Verified Runner',
    description: 'Timeouts, retries, rate limits, and logs tested via simulated endpoints.',
  },
  C: {
    label: 'Live Auth + Live API',
    description: 'Authenticated against a real vendor sandbox.',
  },
};
