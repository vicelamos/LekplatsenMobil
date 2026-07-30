import { buildCheckinDoc, CHECKIN_REQUIRED_FIELDS } from '../../utils/checkinDocument';

const bas = {
  playgroundId: 'pg1',
  playgroundName: 'Slottsskogens lekplats',
  rating: 4,
  userId: 'alice',
  userSmeknamn: 'Alice',
};

describe('buildCheckinDoc – snabbincheckning', () => {
  it('bygger ett komplett dokument av bara betyg och lekplats', () => {
    const doc = buildCheckinDoc(bas);

    expect(doc.betyg).toBe(4);
    expect(doc.lekplatsId).toBe('pg1');
    expect(doc.lekplatsNamn).toBe('Slottsskogens lekplats');
    expect(doc.userId).toBe('alice');
    expect(doc.userSmeknamn).toBe('Alice');
  });

  /**
   * Molnfunktionerna och flödet läser de här fälten utan att kolla om de
   * finns. Saknas de blir det tysta fel långt bort från orsaken.
   */
  it('sätter alla fält molnfunktionerna och flödet förutsätter', () => {
    const doc = buildCheckinDoc(bas);
    for (const falt of CHECKIN_REQUIRED_FIELDS) {
      expect(doc).toHaveProperty(falt);
    }
  });

  it('ger tomma standardvärden för allt valfritt', () => {
    const doc = buildCheckinDoc(bas);

    expect(doc.kommentar).toBe('');
    expect(doc.bildUrl).toBe('');
    expect(doc.commentCount).toBe(0);
    expect(doc.likes).toEqual([]);
    expect(doc.taggadeVanner).toEqual([]);
    expect(doc.gjordaAktiviteter).toEqual([]);
    expect(doc.klaradeUtmaningar).toEqual([]);
    expect(doc.tidPaLekplats).toBe('');
  });

  it('sätter INTE tidsstämpeln – den ska komma från servern', () => {
    expect(buildCheckinDoc(bas)).not.toHaveProperty('timestamp');
  });
});

describe('buildCheckinDoc – detaljer', () => {
  it('tar med kommentar, aktiviteter och taggade vänner när de finns', () => {
    const doc = buildCheckinDoc({
      ...bas,
      kommentar: '  Toppen!  ',
      gjordaAktiviteter: ['gunga'],
      klaradeUtmaningar: ['klättra'],
      taggadeVanner: ['bob'],
      tidPaLekplats: '1 timme',
    });

    expect(doc.kommentar).toBe('Toppen!');
    expect(doc.gjordaAktiviteter).toEqual(['gunga']);
    expect(doc.klaradeUtmaningar).toEqual(['klättra']);
    expect(doc.taggadeVanner).toEqual(['bob']);
    expect(doc.tidPaLekplats).toBe('1 timme');
  });

  it('markerar gästincheckningar', () => {
    expect(buildCheckinDoc({ ...bas, isGuest: true }).isGuest).toBe(true);
    expect(buildCheckinDoc(bas).isGuest).toBeUndefined();
  });

  /** Gäster får inte tagga vänner eller registrera utmaningar. */
  it('nollar sociala fält för gäster', () => {
    const doc = buildCheckinDoc({
      ...bas,
      isGuest: true,
      taggadeVanner: ['bob'],
      klaradeUtmaningar: ['klättra'],
      gjordaAktiviteter: ['gunga'],
    });

    expect(doc.taggadeVanner).toEqual([]);
    expect(doc.klaradeUtmaningar).toEqual([]);
    expect(doc.gjordaAktiviteter).toEqual([]);
  });
});

describe('buildCheckinDoc – validering', () => {
  it('kräver lekplats', () => {
    expect(() => buildCheckinDoc({ ...bas, playgroundId: '' })).toThrow(/lekplats/i);
  });

  it('kräver användare', () => {
    expect(() => buildCheckinDoc({ ...bas, userId: null })).toThrow(/användare/i);
  });

  it('kräver betyg mellan 1 och 5', () => {
    expect(() => buildCheckinDoc({ ...bas, rating: 0 })).toThrow(/betyg/i);
    expect(() => buildCheckinDoc({ ...bas, rating: 6 })).toThrow(/betyg/i);
    expect(() => buildCheckinDoc({ ...bas, rating: null })).toThrow(/betyg/i);
  });

  it('tolkar betyg som kommer som sträng', () => {
    expect(buildCheckinDoc({ ...bas, rating: '3' }).betyg).toBe(3);
  });

  it('avvisar betyg som inte är ett tal', () => {
    expect(() => buildCheckinDoc({ ...bas, rating: 'fyra' })).toThrow(/betyg/i);
  });

  it('faller tillbaka på tomt smeknamn i stället för att krascha', () => {
    expect(buildCheckinDoc({ ...bas, userSmeknamn: undefined }).userSmeknamn).toBe('');
  });
});
