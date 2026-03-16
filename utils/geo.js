
// utils/geo.js
// Parser som hanterar position lagrad som sträng: "[57.7408° N, 12.9031° E]" eller "57.7408, 12.9031"
// Hanterar även redan-normaliserade objekt { latitude, longitude }

export const parsePosition = (raw) => {
  if (!raw) return null;

  // 1) Redan ett objekt { latitude, longitude }
  if (
    typeof raw === 'object' &&
    typeof raw.latitude === 'number' &&
    typeof raw.longitude === 'number'
  ) {
    return { latitude: raw.latitude, longitude: raw.longitude };
  }

  // 2) Sträng med grader och riktning, ex: "[57.7408° N, 12.9031° E]" eller "57.7408° N, 12.9031° E"
  if (typeof raw === 'string') {
    const s = raw.replace(/[\[\]]/g, '').trim();
    const match = s.match(
      /(-?\d+(\.\d+)?)\s*°?\s*([NS])?,\s*(-?\d+(\.\d+)?)\s*°?\s*([EW])?/i
    );
    if (match) {
      let lat = parseFloat(match[1]);
      let lng = parseFloat(match[4]);
      const ns = (match[3] || '').toUpperCase();
      const ew = (match[6] || '').toUpperCase();
      if (ns === 'S') lat = -Math.abs(lat);
      if (ns === 'N') lat = Math.abs(lat);
      if (ew === 'W') lng = -Math.abs(lng);
      if (ew === 'E') lng = Math.abs(lng);
      if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
    }

    // 3) Enkel sträng "57.7408, 12.9031"
    const parts = s.split(',').map((x) => parseFloat(x.trim()));
    if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
      return { latitude: parts[0], longitude: parts[1] };
    }
  }

  return null;
};

// Beräknar avståndet mellan två koordinater i meter med haversine-formeln
export const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2) return null;
  
  const R = 6371e3; // Jordens radie i meter
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Avstånd i meter
};

// Formaterar avståndet till läsbar sträng
export const formatDistance = (meters) => {
  if (!meters) return null;
  
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
};

``
