import { joinSponsorData } from '../../utils/playgroundSponsors';

const sponsorer = [
  { id: 's1', name: 'Glassbaren' },
  { id: 's2', name: 'Cykelhandlaren' },
];

const lekplats = (id, sponsorship) => ({ id, namn: `Lekplats ${id}`, sponsorship });

describe('joinSponsorData', () => {
  it('kopplar på sponsordata för aktiv sponsring', () => {
    const [pg] = joinSponsorData(
      [lekplats('pg1', { active: true, sponsorId: 's1' })],
      sponsorer
    );
    expect(pg.sponsorData).toEqual({ id: 's1', name: 'Glassbaren' });
    expect(pg.sponsorName).toBe('Glassbaren');
  });

  it('kopplar inte på något för inaktiv sponsring', () => {
    const [pg] = joinSponsorData(
      [lekplats('pg1', { active: false, sponsorId: 's1' })],
      sponsorer
    );
    expect(pg.sponsorData).toBeNull();
    expect(pg.sponsorName).toBeNull();
  });

  it('kopplar inte på något när sponsorn inte finns', () => {
    const [pg] = joinSponsorData(
      [lekplats('pg1', { active: true, sponsorId: 'saknas' })],
      sponsorer
    );
    expect(pg.sponsorData).toBeNull();
    expect(pg.sponsorName).toBeNull();
  });

  it('klarar lekplats helt utan sponsring', () => {
    const [pg] = joinSponsorData([lekplats('pg1')], sponsorer);
    expect(pg.sponsorData).toBeNull();
    expect(pg.sponsorName).toBeNull();
  });

  it('klarar sponsring utan sponsorId', () => {
    const [pg] = joinSponsorData([lekplats('pg1', { active: true })], sponsorer);
    expect(pg.sponsorData).toBeNull();
  });

  it('behåller lekplatsens övriga fält', () => {
    const [pg] = joinSponsorData([lekplats('pg1', { active: true, sponsorId: 's1' })], sponsorer);
    expect(pg.id).toBe('pg1');
    expect(pg.namn).toBe('Lekplats pg1');
  });

  it('muterar inte indata', () => {
    const original = lekplats('pg1', { active: true, sponsorId: 's1' });
    joinSponsorData([original], sponsorer);
    expect(original).not.toHaveProperty('sponsorData');
  });

  it('klarar tomma listor', () => {
    expect(joinSponsorData([], sponsorer)).toEqual([]);
    expect(joinSponsorData()).toEqual([]);
  });

  it('klarar att sponsorlistan saknas', () => {
    const [pg] = joinSponsorData([lekplats('pg1', { active: true, sponsorId: 's1' })]);
    expect(pg.sponsorData).toBeNull();
  });

  it('slår upp sponsorer i konstant tid oavsett antal', () => {
    const manga = Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, name: `S${i}` }));
    const [pg] = joinSponsorData(
      [lekplats('pg1', { active: true, sponsorId: 's499' })],
      manga
    );
    expect(pg.sponsorName).toBe('S499');
  });
});
