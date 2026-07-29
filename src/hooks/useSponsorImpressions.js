import { useRef } from 'react';
import { trackSponsorEvent } from '../../utils/sponsorAnalytics';
import {
  createSessionImpressionTracker,
  sponsorIdsFromViewableItems,
} from '../../utils/sponsorImpressions';

/**
 * Minst 50 % av kortet synligt i minst en sekund innan det räknas som en
 * visning. Följer IAB:s tumregel för annonsvisningar och är det vi kan
 * försvara mot en sponsor som frågar vad siffran betyder.
 */
export const SPONSOR_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 1000,
};

/**
 * Delas medvetet mellan alla listor i appen: en sponsor räknas högst en gång
 * per appsession, oavsett om badgen dyker upp både på Hem och i Sök.
 */
const sessionTracker = createSessionImpressionTracker();

/**
 * Ger en FlatList det den behöver för att logga sponsorvisningar korrekt.
 *
 *   const { onViewableItemsChanged, viewabilityConfig } = useSponsorImpressions();
 *   <FlatList onViewableItemsChanged={...} viewabilityConfig={...} />
 */
export function useSponsorImpressions() {
  // FlatList kastar fel om callbacken byter identitet mellan renderingar,
  // därför en ref som skapas en gång.
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const nya = sessionTracker.take(sponsorIdsFromViewableItems(viewableItems));
    nya.forEach((sponsorId) => trackSponsorEvent(sponsorId, 'badgeImpressions'));
  }).current;

  return { onViewableItemsChanged, viewabilityConfig: SPONSOR_VIEWABILITY_CONFIG };
}
