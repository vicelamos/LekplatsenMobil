import { storageUploadUrl } from '../../utils/storagePaths';

const PROD = 'lekplatsen-907fb.firebasestorage.app';
const DEV = 'viktor-2e4f9.firebasestorage.app';

describe('storageUploadUrl', () => {
  it('bygger uppladdnings-URL från referensens bucket', () => {
    const url = storageUploadUrl({ bucket: PROD, fullPath: 'profilbilder/alice' });
    expect(url).toBe(
      `https://firebasestorage.googleapis.com/v0/b/${PROD}/o/profilbilder%2Falice`
    );
  });

  /**
   * Regressionstest. Tre skärmar hårdkodade prod-bucketen, vilket gjorde att
   * uppladdningar från en dev-build hamnade i produktion. URL:en måste alltid
   * följa referensen.
   */
  it('använder dev-bucketen när referensen pekar på dev', () => {
    const url = storageUploadUrl({ bucket: DEV, fullPath: 'profilbilder/alice' });
    expect(url).toContain(DEV);
    expect(url).not.toContain('lekplatsen-907fb');
  });

  it('kodar snedstreck i sökvägen', () => {
    const url = storageUploadUrl({ bucket: DEV, fullPath: 'images/checkins/ci1/1.jpg' });
    expect(url).toContain('images%2Fcheckins%2Fci1%2F1.jpg');
    expect(url).not.toContain('/o/images/');
  });

  it('kastar fel när bucket saknas', () => {
    expect(() => storageUploadUrl({ fullPath: 'a/b' })).toThrow(/bucket/);
    expect(() => storageUploadUrl({ bucket: '', fullPath: 'a/b' })).toThrow(/bucket/);
  });

  it('kastar fel när sökvägen saknas', () => {
    expect(() => storageUploadUrl({ bucket: DEV })).toThrow(/fullPath/);
  });

  it('kastar fel utan referens', () => {
    expect(() => storageUploadUrl()).toThrow();
    expect(() => storageUploadUrl(null)).toThrow();
  });
});
