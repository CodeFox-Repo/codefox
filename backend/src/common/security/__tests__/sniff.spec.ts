import { sniff } from '../file_check';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF = Buffer.from('GIF89a', 'ascii');
const webp = () =>
  Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
  ]);

/**
 * The one check a client cannot lie about. Both upload roads depend on it:
 * multipart avatars and base64 chat attachments.
 */
describe('sniff', () => {
  it('names each format by its magic bytes', () => {
    expect(sniff(Buffer.concat([PNG, Buffer.alloc(20)]))).toBe('image/png');
    expect(sniff(Buffer.concat([JPEG, Buffer.alloc(20)]))).toBe('image/jpeg');
    expect(sniff(webp())).toBe('image/webp');
    expect(sniff(Buffer.concat([GIF, Buffer.alloc(20)]))).toBe('image/gif');
  });

  it('refuses bytes that are not an image, whatever they claim', () => {
    // The exact shape that reached disk as a .png: a big blob of one byte.
    expect(sniff(Buffer.alloc(6 * 1024 * 1024, 0x41))).toBeUndefined();
    expect(sniff(Buffer.from('<script>alert(1)</script>'))).toBeUndefined();
    expect(sniff(Buffer.from('%PDF-1.7'))).toBeUndefined();
  });

  it('refuses a buffer too short to carry a signature', () => {
    expect(sniff(Buffer.alloc(0))).toBeUndefined();
    expect(sniff(PNG.subarray(0, 4))).toBeUndefined();
    expect(sniff(Buffer.from('RIFF', 'ascii'))).toBeUndefined();
  });

  it('does not mistake a RIFF container that is not WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.alloc(4),
      Buffer.from('WAVE', 'ascii'),
    ]);
    expect(sniff(wav)).toBeUndefined();
  });
});
