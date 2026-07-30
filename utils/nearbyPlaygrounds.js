/**
 * Ren logik för "vilken lekplats står användaren på?".
 *
 * Ingen firebase-import — hela lekplatslistan finns redan i minnet via
 * playgroundService, så det här är bara räkning på data vi har.
 */
import { parsePosition, calculateDistance } from './geo';

/** Inom så här många meter antar vi att användaren är PÅ lekplatsen. */
export const NEARBY_RADIUS_M = 150;

/**
 * Lekplatser sorterade efter avstånd, med `distance` i meter påsatt.
 * Lekplatser utan tolkbar position utelämnas.
 */
export function playgroundsByDistance(playgrounds = [], userLocation = null) {
  if (!userLocation || !playgrounds?.length) return [];

  return (playgrounds || [])
    .map((pg) => {
      const pos = parsePosition(pg?.position);
      if (!pos) return null;
      const distance = calculateDistance(userLocation, pos);
      if (distance === null) return null;
      return { ...pg, distance };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Väljer vilken lekplats närhetsprompten ska föreslå.
 *
 * @param {object[]} playgrounds
 * @param {{latitude: number, longitude: number}|null} userLocation
 * @param {object} [options]
 * @param {number} [options.radius]      - meter, default NEARBY_RADIUS_M
 * @param {number|null} [options.accuracy] - GPS-noggrannhet i meter
 * @param {string[]} [options.excludeIds] - redan incheckade eller avfärdade
 * @returns {{playground: object, distance: number, confident: boolean,
 *            alternatives: object[]}|null}
 */
/**
 * Byter huvudförslag till ett av alternativen — för när användaren säger
 * "nej, jag står på den där i stället". Det tidigare förslaget hamnar bland
 * alternativen, fortfarande sorterat på avstånd.
 *
 * Returnerar kandidaten oförändrad om id:t inte finns bland alternativen.
 */
export function promoteAlternative(candidate, playgroundId) {
  if (!candidate?.playground) return null;
  if (!playgroundId || playgroundId === candidate.playground.id) return candidate;

  const alla = [candidate.playground, ...(candidate.alternatives || [])];
  const valt = alla.find((p) => p.id === playgroundId);
  if (!valt) return candidate;

  return {
    ...candidate,
    playground: valt,
    distance: valt.distance,
    alternatives: alla
      .filter((p) => p.id !== playgroundId)
      .sort((a, b) => a.distance - b.distance),
  };
}

export function pickProximityCandidate(playgrounds = [], userLocation = null, options = {}) {
  const {
    radius = NEARBY_RADIUS_M,
    accuracy = null,
    excludeIds = [],
  } = options;

  const uteslutna = new Set(excludeIds);

  const inomRadien = playgroundsByDistance(playgrounds, userLocation).filter(
    (pg) =>
      pg.distance <= radius &&
      pg.status !== 'review' &&
      !uteslutna.has(pg.id)
  );

  if (inomRadien.length === 0) return null;

  const [narmast, ...ovriga] = inomRadien;

  return {
    playground: narmast,
    distance: narmast.distance,
    // Är GPS-osäkerheten större än radien kan vi inte påstå att användaren är
    // på plats — gränssnittet ska fråga i stället för att slå fast.
    confident: accuracy === null || accuracy <= radius,
    alternatives: ovriga,
  };
}
