import { auth } from '../../firebase';
import { useLoginPrompt } from '../contexts/LoginPrompt';

/**
 * Hook som returnerar en funktion för att kolla om användaren är inloggad.
 * Om inte, visas en global dialog som ber användaren logga in. Användaren
 * kan välja att gå till Login eller stänga dialogen och stanna kvar.
 *
 * Anonyma användare (gäst-incheckning) räknas inte som inloggade.
 *
 * Användning:
 *   const requireAuth = useAuthGate();
 *   const handleAction = () => {
 *     if (!requireAuth('CheckIn', { playgroundId })) return;
 *     // ... fortsätt med actionen
 *   };
 */
export function useAuthGate() {
  const { show } = useLoginPrompt();

  return (returnScreen, returnParams) => {
    if (auth.currentUser && !auth.currentUser.isAnonymous) return true;
    show(returnScreen, returnParams);
    return false;
  };
}
