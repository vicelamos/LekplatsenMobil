/**
 * Komponenttester.
 *
 * Egen konfigurationsfil i stället för ett inline-projekt i package.json, och
 * presetens värden ärvs genom spridning i stället för att skrivas över. Den
 * gamla inline-konfigurationen hade en egen `transformIgnorePatterns` med en
 * trasig regex — `expo` hamnade utanför den negativa lookaheaden, så expos
 * TypeScript-källa transformerades aldrig.
 */
const preset = require('jest-expo/jest-preset');

module.exports = {
  ...preset,
  displayName: 'components',
  rootDir: __dirname,
  testMatch: [
    '<rootDir>/__tests__/components/**/*.test.js',
    '<rootDir>/__tests__/ui/**/*.test.js',
  ],
  setupFiles: [
    ...(preset.setupFiles || []),
    '<rootDir>/__tests__/components/setupEnv.js',
  ],
  setupFilesAfterEnv: [
    ...(preset.setupFilesAfterEnv || []),
    '<rootDir>/__tests__/components/setupTests.js',
  ],
};
