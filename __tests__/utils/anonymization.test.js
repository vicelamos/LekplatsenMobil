import {
  ANONYMIZED_USER_ID,
  ANONYMIZED_DISPLAY_NAME,
  storagePathFromDownloadUrl,
  isLegacyCheckinImagePath,
  checkinImagePath,
  anonymizedCheckinFields,
} from '../../utils/anonymization';

const downloadUrl = (path) =>
  `https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=abc-123`;

describe('checkinImagePath', () => {
  it('bygger en sökväg utan användarens UID', () => {
    const path = checkinImagePath('ci1', '1700000000000.jpg');
    expect(path).toBe('images/checkins/ci1/1700000000000.jpg');
    expect(path).not.toContain('alice');
  });
});

describe('storagePathFromDownloadUrl', () => {
  it('plockar ut sökvägen ur en nedladdnings-URL', () => {
    expect(storagePathFromDownloadUrl(downloadUrl('images/checkins/ci1/1.jpg')))
      .toBe('images/checkins/ci1/1.jpg');
  });

  it('avkodar sökvägen korrekt', () => {
    expect(storagePathFromDownloadUrl(downloadUrl('images/checkins/alice/ci1/1.jpg')))
      .toBe('images/checkins/alice/ci1/1.jpg');
  });

  it('returnerar null för tomma eller ogiltiga värden', () => {
    expect(storagePathFromDownloadUrl('')).toBeNull();
    expect(storagePathFromDownloadUrl(null)).toBeNull();
    expect(storagePathFromDownloadUrl(undefined)).toBeNull();
    expect(storagePathFromDownloadUrl('https://exempel.se/bild.jpg')).toBeNull();
  });

  it('klarar en URL utan frågesträng', () => {
    expect(storagePathFromDownloadUrl('https://firebasestorage.googleapis.com/v0/b/demo/o/images%2Fcheckins%2Fci1%2F1.jpg'))
      .toBe('images/checkins/ci1/1.jpg');
  });
});

describe('isLegacyCheckinImagePath', () => {
  it('känner igen det gamla schemat med UID i sökvägen', () => {
    expect(isLegacyCheckinImagePath('images/checkins/alice/ci1/1.jpg')).toBe(true);
  });

  it('känner igen det nya schemat utan UID', () => {
    expect(isLegacyCheckinImagePath('images/checkins/ci1/1.jpg')).toBe(false);
  });

  it('bryr sig inte om andra bildtyper', () => {
    expect(isLegacyCheckinImagePath('images/playgrounds/pg1/1.jpg')).toBe(false);
    expect(isLegacyCheckinImagePath('profilbilder/alice')).toBe(false);
  });

  it('returnerar false för tomma värden', () => {
    expect(isLegacyCheckinImagePath('')).toBe(false);
    expect(isLegacyCheckinImagePath(null)).toBe(false);
  });
});

describe('anonymizedCheckinFields', () => {
  it('ersätter användar-id och smeknamn', () => {
    const fields = anonymizedCheckinFields({ userId: 'alice', userSmeknamn: 'Alice' });
    expect(fields.userId).toBe(ANONYMIZED_USER_ID);
    expect(fields.userSmeknamn).toBe(ANONYMIZED_DISPLAY_NAME);
  });

  it('behåller bilden när den ligger på det nya schemat', () => {
    const url = downloadUrl('images/checkins/ci1/1.jpg');
    const fields = anonymizedCheckinFields({ userId: 'alice', bildUrl: url });
    expect(fields).not.toHaveProperty('bildUrl');
  });

  it('nollar bilden när sökvägen innehåller UID', () => {
    const url = downloadUrl('images/checkins/alice/ci1/1.jpg');
    const fields = anonymizedCheckinFields({ userId: 'alice', bildUrl: url });
    expect(fields.bildUrl).toBe('');
  });

  it('klarar incheckning utan bild', () => {
    const fields = anonymizedCheckinFields({ userId: 'alice' });
    expect(fields).not.toHaveProperty('bildUrl');
    expect(fields.userId).toBe(ANONYMIZED_USER_ID);
  });

  it('klarar anrop utan argument', () => {
    expect(anonymizedCheckinFields().userId).toBe(ANONYMIZED_USER_ID);
  });

  it('sentinelvärdet är inte ett giltigt Firebase-UID någon kan äga', () => {
    // Måste vara en icke-tom sträng, annars kraschar getDoc(doc(db,'users',id))
    expect(typeof ANONYMIZED_USER_ID).toBe('string');
    expect(ANONYMIZED_USER_ID.length).toBeGreaterThan(0);
  });
});
