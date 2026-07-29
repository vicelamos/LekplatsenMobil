/**
 * Läsbudgettester: mäter hur många dokument en operation faktiskt läser.
 *
 * Kräver körande Firestore-emulator, precis som regeltesterna, och ligger
 * därför utanför `projects`-listan i package.json. Kör via `npm run test:perf`.
 */
module.exports = {
  displayName: 'perf',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/perf/**/*.test.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  // Seedning av tusentals dokument tar tid
  testTimeout: 180000,
  // Delar emulatorinstans – se kommentaren i jest.rules.config.js
  maxWorkers: 1,
};
