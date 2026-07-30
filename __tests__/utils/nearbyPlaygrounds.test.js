import {
  NEARBY_RADIUS_M,
  playgroundsByDistance,
  pickProximityCandidate,
  promoteAlternative,
} from '../../utils/nearbyPlaygrounds';

// Slottsskogen som utgångspunkt. ~0,00001 grad latitud ≈ 1,1 m.
const HERE = { latitude: 57.68700, longitude: 11.94500 };

/** Lekplats på ungefär `meters` avstånd rakt norrut. */
const pgAt = (id, meters, extra = {}) => ({
  id,
  namn: `Lekplats ${id}`,
  position: `${HERE.latitude + meters / 111320}, ${HERE.longitude}`,
  ...extra,
});

describe('playgroundsByDistance', () => {
  it('sorterar närmast först och sätter avstånd', () => {
    const lista = playgroundsByDistance(
      [pgAt('fjarran', 800), pgAt('nara', 50), pgAt('mellan', 300)],
      HERE
    );
    expect(lista.map((p) => p.id)).toEqual(['nara', 'mellan', 'fjarran']);
    expect(lista[0].distance).toBeLessThan(60);
  });

  it('hoppar över lekplatser utan tolkbar position', () => {
    const lista = playgroundsByDistance(
      [{ id: 'trasig', position: 'inte en position' }, pgAt('ok', 50)],
      HERE
    );
    expect(lista.map((p) => p.id)).toEqual(['ok']);
  });

  it('returnerar tom lista utan position', () => {
    expect(playgroundsByDistance([pgAt('a', 10)], null)).toEqual([]);
    expect(playgroundsByDistance([], HERE)).toEqual([]);
    expect(playgroundsByDistance()).toEqual([]);
  });

  it('muterar inte indata', () => {
    const original = pgAt('a', 10);
    playgroundsByDistance([original], HERE);
    expect(original).not.toHaveProperty('distance');
  });
});

describe('pickProximityCandidate', () => {
  const playgrounds = [pgAt('nara', 40), pgAt('ocksa-nara', 90), pgAt('langt', 900)];

  it('väljer den närmaste inom radien', () => {
    const kandidat = pickProximityCandidate(playgrounds, HERE);
    expect(kandidat.playground.id).toBe('nara');
    expect(kandidat.distance).toBeLessThan(NEARBY_RADIUS_M);
  });

  it('erbjuder övriga inom radien som alternativ', () => {
    const kandidat = pickProximityCandidate(playgrounds, HERE);
    expect(kandidat.alternatives.map((p) => p.id)).toEqual(['ocksa-nara']);
    expect(kandidat.alternatives.map((p) => p.id)).not.toContain('langt');
  });

  it('returnerar null när ingenting är inom radien', () => {
    expect(pickProximityCandidate([pgAt('langt', 900)], HERE)).toBeNull();
  });

  it('returnerar null utan position', () => {
    expect(pickProximityCandidate(playgrounds, null)).toBeNull();
  });

  it('returnerar null för tom lista', () => {
    expect(pickProximityCandidate([], HERE)).toBeNull();
    expect(pickProximityCandidate()).toBeNull();
  });

  describe('GPS-osäkerhet', () => {
    it('är säker när noggrannheten är bättre än radien', () => {
      const k = pickProximityCandidate(playgrounds, HERE, { accuracy: 20 });
      expect(k.confident).toBe(true);
    });

    it('är säker när noggrannheten är okänd', () => {
      expect(pickProximityCandidate(playgrounds, HERE).confident).toBe(true);
    });

    /**
     * Med 400 m osäkerhet kan vi inte påstå "du är på X" — gränssnittet ska
     * fråga i stället för att slå fast.
     */
    it('är osäker när noggrannheten är sämre än radien', () => {
      const k = pickProximityCandidate(playgrounds, HERE, { accuracy: 400 });
      expect(k.confident).toBe(false);
      expect(k.playground.id).toBe('nara');
    });
  });

  describe('undviker att tjata', () => {
    it('hoppar över lekplatser användaren redan checkat in på', () => {
      const k = pickProximityCandidate(playgrounds, HERE, { excludeIds: ['nara'] });
      expect(k.playground.id).toBe('ocksa-nara');
    });

    it('hoppar över avfärdade lekplatser', () => {
      const k = pickProximityCandidate(playgrounds, HERE, { excludeIds: ['nara', 'ocksa-nara'] });
      expect(k).toBeNull();
    });

    it('en avfärdad lekplats dyker inte upp bland alternativen heller', () => {
      const k = pickProximityCandidate(playgrounds, HERE, { excludeIds: ['ocksa-nara'] });
      expect(k.playground.id).toBe('nara');
      expect(k.alternatives).toEqual([]);
    });
  });

  it('går att köra med egen radie', () => {
    const k = pickProximityCandidate(playgrounds, HERE, { radius: 50 });
    expect(k.playground.id).toBe('nara');
    expect(k.alternatives).toEqual([]);
  });

  it('utkast och opublicerade lekplatser föreslås inte', () => {
    const k = pickProximityCandidate(
      [pgAt('utkast', 10, { status: 'review' }), pgAt('publik', 80)],
      HERE
    );
    expect(k.playground.id).toBe('publik');
  });
});

describe('promoteAlternative', () => {
  const kandidat = () =>
    pickProximityCandidate([pgAt('a', 40), pgAt('b', 90), pgAt('c', 120)], HERE);

  it('gör det valda alternativet till huvudförslag', () => {
    const bytt = promoteAlternative(kandidat(), 'b');
    expect(bytt.playground.id).toBe('b');
    expect(bytt.distance).toBeCloseTo(bytt.playground.distance, 5);
  });

  it('lägger tillbaka det tidigare förslaget bland alternativen', () => {
    const bytt = promoteAlternative(kandidat(), 'b');
    expect(bytt.alternatives.map((p) => p.id).sort()).toEqual(['a', 'c']);
  });

  it('alternativen ligger kvar i avståndsordning', () => {
    const bytt = promoteAlternative(kandidat(), 'c');
    expect(bytt.alternatives.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('behåller säkerhetsbedömningen', () => {
    const k = pickProximityCandidate([pgAt('a', 40), pgAt('b', 90)], HERE, { accuracy: 400 });
    expect(promoteAlternative(k, 'b').confident).toBe(false);
  });

  it('gör ingenting för okänt id', () => {
    const k = kandidat();
    expect(promoteAlternative(k, 'finns-inte')).toEqual(k);
  });

  it('gör ingenting när id:t redan är huvudförslaget', () => {
    const k = kandidat();
    expect(promoteAlternative(k, 'a')).toEqual(k);
  });

  it('klarar null', () => {
    expect(promoteAlternative(null, 'b')).toBeNull();
    expect(promoteAlternative(undefined, 'b')).toBeNull();
  });
});
