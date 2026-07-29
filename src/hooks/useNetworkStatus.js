import { useState, useEffect } from 'react';

/**
 * Enkel nätverksstatus-hook baserad på online/offline-event.
 * För mer avancerad funktionalitet, installera @react-native-community/netinfo.
 * Returnerar { isConnected }
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Expo/React Native har inte window.addEventListener('online'),
    // men vi kan polla genom att göra en enkel fetch
    let mounted = true;
    let timer;

    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mounted) setIsConnected(true);
      } catch {
        if (mounted) setIsConnected(false);
      }
    };

    checkConnection();
    timer = setInterval(checkConnection, 30000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return { isConnected };
}
