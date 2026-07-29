/**
 * Separat jest-konfiguration för Firestore-säkerhetsregler.
 *
 * Ligger utanför `projects`-listan i package.json med flit: dessa tester
 * kräver en körande Firestore-emulator och ska inte sakta ner `npm test`.
 * Kör dem via `npm run test:rules` (startar emulatorn åt dig).
 */
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/rules/**/*.test.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  testTimeout: 20000,
  /**
   * Alla testfiler delar en och samma emulatorinstans och ett och samma
   * projekt-ID. Kör de parallellt hinner en fils `clearFirestore()` radera
   * en annan fils seedade data mitt i ett test. Serie-körning är enda
   * korrekta läget här.
   */
  maxWorkers: 1,
};
