import { parsePosition, calculateDistance, formatDistance } from '../../utils/geo';

describe('parsePosition', () => {
  it('returnerar null för tomt värde', () => {
    expect(parsePosition(null)).toBeNull();
    expect(parsePosition(undefined)).toBeNull();
    expect(parsePosition('')).toBeNull();
  });

  it('parsar objekt med latitude/longitude', () => {
    const result = parsePosition({ latitude: 57.7408, longitude: 12.9031 });
    expect(result).toEqual({ latitude: 57.7408, longitude: 12.9031 });
  });

  it('parsar sträng med grader och riktning', () => {
    const result = parsePosition('[57.7408° N, 12.9031° E]');
    expect(result).toEqual({ latitude: 57.7408, longitude: 12.9031 });
  });

  it('parsar sträng med sydlig breddgrad', () => {
    const result = parsePosition('33.8688° S, 151.2093° E');
    expect(result).toEqual({ latitude: -33.8688, longitude: 151.2093 });
  });

  it('parsar enkel sträng med komma', () => {
    const result = parsePosition('57.7408, 12.9031');
    expect(result).toEqual({ latitude: 57.7408, longitude: 12.9031 });
  });

  it('returnerar null för ogiltigt format', () => {
    expect(parsePosition('inte en position')).toBeNull();
    expect(parsePosition(42)).toBeNull();
  });
});

describe('calculateDistance', () => {
  it('returnerar null om koordinater saknas', () => {
    expect(calculateDistance(null, { latitude: 0, longitude: 0 })).toBeNull();
    expect(calculateDistance({ latitude: 0, longitude: 0 }, null)).toBeNull();
  });

  it('returnerar 0 för samma punkt', () => {
    const coord = { latitude: 57.7089, longitude: 11.9746 };
    expect(calculateDistance(coord, coord)).toBeCloseTo(0, 0);
  });

  it('beräknar avstånd mellan Göteborg och Stockholm (~400 km)', () => {
    const goteborg = { latitude: 57.7089, longitude: 11.9746 };
    const stockholm = { latitude: 59.3293, longitude: 18.0686 };
    const distance = calculateDistance(goteborg, stockholm);
    // Ska vara ca 398-405 km
    expect(distance).toBeGreaterThan(390000);
    expect(distance).toBeLessThan(410000);
  });
});

describe('formatDistance', () => {
  it('returnerar null för tomt värde', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(0)).toBeNull();
  });

  it('formaterar meter under 1000', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(42)).toBe('42 m');
  });

  it('formaterar kilometer', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(10000)).toBe('10.0 km');
  });
});
