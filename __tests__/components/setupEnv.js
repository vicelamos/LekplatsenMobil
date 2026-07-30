/**
 * Expo installerar flera globaler som lata getters (se
 * node_modules/expo/src/winter/runtime.native.ts). Deras `require` körs först
 * när någon rör egenskapen — och sker det efter att jest rivit modulregistret
 * kraschar sviten med "You are trying to `import` a file outside of the scope
 * of the test code" innan ett enda test hunnit köra.
 *
 * Genom att läsa dem här, medan uppsättningen fortfarande pågår, laddas de i
 * rätt scope.
 */
const lataGlobaler = [
  '__ExpoImportMetaRegistry',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'structuredClone',
];

for (const namn of lataGlobaler) {
  try {
    void globalThis[namn];
  } catch {
    // Vissa finns inte i alla miljöer – det är i sig inget fel.
  }
}
