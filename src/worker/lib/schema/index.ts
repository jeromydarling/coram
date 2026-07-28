/**
 * The schema, and with it the retention registry.
 *
 * Importing this module registers every table (§3.4). Anything that walks the
 * registry — the nightly sweep, the burn switch, the CI gate — imports this
 * rather than an individual file, so a new module's tables cannot be invisible
 * to the sweep just because nobody remembered to import them.
 *
 * Add a module here the same commit you add its migration.
 */

export * from './foundation';
export * from './membra';
export * from './convocare';
