import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import {
  pickProximityCandidate,
  promoteAlternative,
} from '../../utils/nearbyPlaygrounds';
import { remember, activeExclusions } from '../../utils/proximityMemory';
import { loadProximityMemory, saveProximityMemory } from '../services/proximityMemoryStore';

/**
 * Avgör vilken lekplats användaren står på och håller reda på vad hen redan
 * svarat om.
 *
 * All beslutslogik ligger i utils/nearbyPlaygrounds och utils/proximityMemory
 * och är testad där — det här är bara ihopkopplingen mot position och lagring.
 *
 * @param {object[]} playgrounds - hela listan, redan i minnet via playgroundService
 * @returns {{candidate: object|null, dismiss: () => void,
 *            markRated: (id: string) => void, selectAlternative: (pg) => void}}
 */
export function useProximityCandidate(playgrounds = []) {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [memory, setMemory] = useState({});
  const [manualId, setManualId] = useState(null);

  useEffect(() => {
    let avbruten = false;
    (async () => {
      const sparat = await loadProximityMemory();
      if (!avbruten) setMemory(sparat);
    })();
    return () => { avbruten = true; };
  }, []);

  useEffect(() => {
    let avbruten = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (avbruten) return;
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        // Noggrannheten avgör om prompten påstår eller frågar
        setAccuracy(typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null);
      } catch (e) {
        console.warn('useProximityCandidate: kunde inte hämta position', e);
      }
    })();
    return () => { avbruten = true; };
  }, []);

  const candidate = useMemo(() => {
    const auto = pickProximityCandidate(playgrounds, position, {
      accuracy,
      excludeIds: activeExclusions(memory),
    });
    return manualId ? promoteAlternative(auto, manualId) : auto;
  }, [playgrounds, position, accuracy, memory, manualId]);

  const spara = useCallback((nyttMinne) => {
    setMemory(nyttMinne);
    saveProximityMemory(nyttMinne);
  }, []);

  const dismiss = useCallback(() => {
    if (!candidate?.playground) return;
    // Avfärda hela förslaget, inte bara den översta – annars poppar nästa
    // lekplats upp direkt och det känns som att appen tjatar.
    const ids = [candidate.playground, ...(candidate.alternatives || [])].map((p) => p.id);
    let nytt = memory;
    for (const id of ids) nytt = remember(nytt, id, 'dismissed');
    setManualId(null);
    spara(nytt);
  }, [candidate, memory, spara]);

  const markRated = useCallback((playgroundId) => {
    setManualId(null);
    spara(remember(memory, playgroundId, 'rated'));
  }, [memory, spara]);

  const selectAlternative = useCallback((playground) => {
    setManualId(playground?.id || null);
  }, []);

  return { candidate, dismiss, markRated, selectAlternative };
}
