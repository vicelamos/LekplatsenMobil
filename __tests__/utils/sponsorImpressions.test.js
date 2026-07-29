import {
  isGoldSponsor,
  sponsorIdsFromViewableItems,
  createSessionImpressionTracker,
  statsDateKey,
} from '../../utils/sponsorImpressions';

const guldLekplats = (id, sponsorId) => ({
  id,
  sponsorship: { active: true, level: 'guld' },
  sponsorData: { id: sponsorId },
});

describe('isGoldSponsor', () => {
  it('är sann för en aktiv guldsponsring', () => {
    expect(isGoldSponsor(guldLekplats('pg1', 's1'))).toBe(true);
  });

  it('är falsk när sponsringen är inaktiv', () => {
    expect(isGoldSponsor({ sponsorship: { active: false, level: 'guld' } })).toBe(false);
  });

  it('är falsk för en annan sponsornivå', () => {
    expect(isGoldSponsor({ sponsorship: { active: true, level: 'silver' } })).toBe(false);
  });

  it('är falsk när sponsring saknas helt', () => {
    expect(isGoldSponsor({})).toBe(false);
    expect(isGoldSponsor(null)).toBe(false);
    expect(isGoldSponsor(undefined)).toBe(false);
  });
});

describe('sponsorIdsFromViewableItems', () => {
  it('returnerar tom lista för tomt underlag', () => {
    expect(sponsorIdsFromViewableItems()).toEqual([]);
    expect(sponsorIdsFromViewableItems([])).toEqual([]);
  });

  it('plockar ut sponsor-id för synliga guldsponsrade lekplatser', () => {
    const viewable = [
      { item: guldLekplats('pg1', 's1') },
      { item: guldLekplats('pg2', 's2') },
    ];
    expect(sponsorIdsFromViewableItems(viewable)).toEqual(['s1', 's2']);
  });

  it('hoppar över lekplatser utan guldsponsring', () => {
    const viewable = [
      { item: guldLekplats('pg1', 's1') },
      { item: { id: 'pg2' } },
      { item: { id: 'pg3', sponsorship: { active: true, level: 'silver' }, sponsorData: { id: 's3' } } },
    ];
    expect(sponsorIdsFromViewableItems(viewable)).toEqual(['s1']);
  });

  it('hoppar över guldsponsring som saknar sponsordata', () => {
    const viewable = [
      { item: { id: 'pg1', sponsorship: { active: true, level: 'guld' } } },
      { item: { id: 'pg2', sponsorship: { active: true, level: 'guld' }, sponsorData: {} } },
    ];
    expect(sponsorIdsFromViewableItems(viewable)).toEqual([]);
  });

  it('tål poster utan item', () => {
    expect(sponsorIdsFromViewableItems([{}, null, { item: null }])).toEqual([]);
  });

  it('returnerar samma sponsor en gång även om den syns på två kort', () => {
    const viewable = [
      { item: guldLekplats('pg1', 's1') },
      { item: guldLekplats('pg2', 's1') },
    ];
    expect(sponsorIdsFromViewableItems(viewable)).toEqual(['s1']);
  });
});

describe('createSessionImpressionTracker', () => {
  it('släpper igenom en sponsor första gången den syns', () => {
    const tracker = createSessionImpressionTracker();
    expect(tracker.take(['s1'])).toEqual(['s1']);
  });

  it('släpper inte igenom samma sponsor en andra gång', () => {
    const tracker = createSessionImpressionTracker();
    tracker.take(['s1']);
    expect(tracker.take(['s1'])).toEqual([]);
  });

  it('släpper igenom nya sponsorer men filtrerar bort redan räknade', () => {
    const tracker = createSessionImpressionTracker();
    tracker.take(['s1']);
    expect(tracker.take(['s1', 's2', 's3'])).toEqual(['s2', 's3']);
  });

  it('dubbelräknar inte inom ett och samma anrop', () => {
    const tracker = createSessionImpressionTracker();
    expect(tracker.take(['s1', 's1'])).toEqual(['s1']);
  });

  it('ignorerar tomma värden', () => {
    const tracker = createSessionImpressionTracker();
    expect(tracker.take([null, undefined, '', 's1'])).toEqual(['s1']);
  });

  it('tål anrop utan argument', () => {
    const tracker = createSessionImpressionTracker();
    expect(tracker.take()).toEqual([]);
  });

  it('rapporterar vad som redan räknats', () => {
    const tracker = createSessionImpressionTracker();
    tracker.take(['s1']);
    expect(tracker.hasCounted('s1')).toBe(true);
    expect(tracker.hasCounted('s2')).toBe(false);
    expect(tracker.size).toBe(1);
  });

  it('kan nollställas', () => {
    const tracker = createSessionImpressionTracker();
    tracker.take(['s1']);
    tracker.reset();
    expect(tracker.hasCounted('s1')).toBe(false);
    expect(tracker.take(['s1'])).toEqual(['s1']);
  });

  it('två trackers delar inte tillstånd', () => {
    const a = createSessionImpressionTracker();
    const b = createSessionImpressionTracker();
    a.take(['s1']);
    expect(b.take(['s1'])).toEqual(['s1']);
  });
});

describe('statsDateKey', () => {
  it('formaterar som ÅÅÅÅ-MM-DD', () => {
    expect(statsDateKey(new Date('2026-07-29T10:15:00Z'))).toBe('2026-07-29');
  });

  it('använder UTC, samma som statistikdokumentets id', () => {
    // 00:30 svensk sommartid är 22:30 UTC dagen innan
    expect(statsDateKey(new Date('2026-07-30T22:30:00Z'))).toBe('2026-07-30');
    expect(statsDateKey(new Date('2026-07-29T23:59:59Z'))).toBe('2026-07-29');
    expect(statsDateKey(new Date('2026-07-30T00:00:01Z'))).toBe('2026-07-30');
  });

  it('utgår från nuvarande tidpunkt utan argument', () => {
    expect(statsDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('createSessionImpressionTracker – dygnsgräns', () => {
  /** Låter testet styra vilket dygn trackern tror att det är. */
  const withClock = (startDay) => {
    let day = startDay;
    const tracker = createSessionImpressionTracker({ dateKey: () => day });
    return { tracker, setDay: (d) => { day = d; } };
  };

  it('räknar samma sponsor igen när dygnet byts', () => {
    const { tracker, setDay } = withClock('2026-07-29');
    expect(tracker.take(['s1'])).toEqual(['s1']);
    expect(tracker.take(['s1'])).toEqual([]);

    setDay('2026-07-30');
    expect(tracker.take(['s1'])).toEqual(['s1']);
  });

  it('nollställer alla sponsorer vid dygnsbyte, inte bara en', () => {
    const { tracker, setDay } = withClock('2026-07-29');
    tracker.take(['s1', 's2', 's3']);
    expect(tracker.size).toBe(3);

    setDay('2026-07-30');
    expect(tracker.size).toBe(0);
    expect(tracker.take(['s1', 's2', 's3'])).toEqual(['s1', 's2', 's3']);
  });

  it('hasCounted speglar dygnsbytet', () => {
    const { tracker, setDay } = withClock('2026-07-29');
    tracker.take(['s1']);
    expect(tracker.hasCounted('s1')).toBe(true);

    setDay('2026-07-30');
    expect(tracker.hasCounted('s1')).toBe(false);
  });

  it('dedupar fortfarande inom samma dygn', () => {
    const { tracker, setDay } = withClock('2026-07-29');
    tracker.take(['s1']);
    setDay('2026-07-29');
    expect(tracker.take(['s1'])).toEqual([]);
  });

  it('räknar på nytt även efter flera dygns paus', () => {
    const { tracker, setDay } = withClock('2026-07-29');
    tracker.take(['s1']);
    setDay('2026-08-15');
    expect(tracker.take(['s1'])).toEqual(['s1']);
  });
});
