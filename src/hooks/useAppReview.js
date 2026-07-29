import { useCallback } from 'react';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_KEY = '@lekplatsen_review_prompted';
const MIN_CHECKINS = 3;

/**
 * Hook som ger en funktion `maybeRequestReview` att kalla efter en lyckad incheckning.
 * Promptar bara efter MIN_CHECKINS incheckningar och max en gång.
 */
export function useAppReview() {
  const maybeRequestReview = useCallback(async (totalCheckinCount) => {
    try {
      if (totalCheckinCount < MIN_CHECKINS) return;

      const alreadyPrompted = await AsyncStorage.getItem(REVIEW_KEY);
      if (alreadyPrompted) return;

      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return;

      await StoreReview.requestReview();
      await AsyncStorage.setItem(REVIEW_KEY, 'true');
    } catch {
      // Tyst fel - recensionsprompt är inte kritiskt
    }
  }, []);

  return { maybeRequestReview };
}
