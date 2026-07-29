// Mocka expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri, actions, options) => ({
    uri: `compressed_${uri}`,
  })),
  SaveFormat: { JPEG: 'jpeg' },
}));

import { compressImage, getReadableFileSize } from '../../utils/imageCompression';

describe('compressImage', () => {
  it('returnerar en komprimerad URI', async () => {
    const result = await compressImage('file://photo.jpg');
    expect(result).toBe('compressed_file://photo.jpg');
  });

  it('anropar manipulateAsync med rätt kvalitet', async () => {
    const { manipulateAsync } = require('expo-image-manipulator');
    await compressImage('file://test.jpg', { quality: 0.5 });
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://test.jpg',
      [],
      { compress: 0.5, format: 'jpeg' }
    );
  });

  it('använder standardkvalitet 0.75', async () => {
    const { manipulateAsync } = require('expo-image-manipulator');
    manipulateAsync.mockClear();
    await compressImage('file://test.jpg');
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://test.jpg',
      [],
      { compress: 0.75, format: 'jpeg' }
    );
  });
});

describe('getReadableFileSize', () => {
  it('visar MB för stora filer', () => {
    // 2 MB base64 ≈ 2_796_203 chars
    const bigBase64 = 'A'.repeat(2796203);
    const result = getReadableFileSize(bigBase64);
    expect(result).toMatch(/^\d+\.\d+ MB$/);
  });

  it('visar KB för mindre filer', () => {
    const smallBase64 = 'A'.repeat(1000);
    const result = getReadableFileSize(smallBase64);
    expect(result).toMatch(/^\d+\.\d+ KB$/);
  });
});
