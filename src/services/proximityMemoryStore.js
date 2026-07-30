import AsyncStorage from '@react-native-async-storage/async-storage';
import { prune } from '../../utils/proximityMemory';

const NYCKEL = '@lekplatsen_proximity_memory';

/**
 * Läser minnet av avfärdade och betygsatta lekplatser.
 *
 * Rensar utgångna poster direkt, så det aldrig växer obegränsat. Minnet är en
 * bekvämlighet — går läsningen fel är rätt beteende att fråga användaren igen,
 * inte att krascha.
 */
export async function loadProximityMemory() {
  try {
    const rad = await AsyncStorage.getItem(NYCKEL);
    return prune(rad ? JSON.parse(rad) : {});
  } catch (e) {
    console.warn('Kunde inte läsa närhetsminnet:', e);
    return {};
  }
}

export async function saveProximityMemory(memory) {
  try {
    await AsyncStorage.setItem(NYCKEL, JSON.stringify(prune(memory)));
  } catch (e) {
    console.warn('Kunde inte spara närhetsminnet:', e);
  }
}
