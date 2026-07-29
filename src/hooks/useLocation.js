import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

/**
 * Hook som hämtar användarens plats med behörighetsbegäran.
 * Returnerar { location, loading, error, refresh }
 * location = { latitude, longitude } eller null
 */
export function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Platstillstånd nekades');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return { location, loading, error, refresh: fetchLocation };
}
