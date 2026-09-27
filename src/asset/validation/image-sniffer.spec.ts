import {
  AssetKind,
  assetPolicies,
  DeclaredFile,
} from '../domain/asset.interface';
import { inspectUpload } from './image-sniffer';
import { jpegHeader, pngHeader, webpHeader } from './test-images.fixture-spec';

const policy = assetPolicies[AssetKind.PROFILE_IMAGE];

function declared(overrides: Partial<DeclaredFile> = {}): DeclaredFile {
  return {
    filename: 'me.png',
    contentType: 'image/png',
    byteSize: 1000,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

function inspect(header: Buffer, file = declared(), stored = file.byteSize) {
  return inspectUpload(policy, file, stored, header);
}

describe('inspectUpload', () => {
  describe('accepts real images and reports what the bytes say', () => {
    it.each([
      ['image/png', pngHeader(640, 480)],
      ['image/jpeg', jpegHeader(640, 480)],
      ['image/webp', webpHeader(640, 480)],
    ])('%s', (contentType, header) => {
      expect(inspect(header, declared({ contentType }))).toEqual({
        ok: true,
        actual: { contentType, byteSize: 1000, width: 640, height: 480 },
      });
    });
  });

  describe('rejects', () => {
    it('a decompression bomb: a tiny PNG declaring 40000 × 40000', () => {
      const result = inspect(pngHeader(40_000, 40_000));
      expect(result.ok).toBe(false);
    });

    it('an image over the pixel ceiling but within the edge limit', () => {
      // 8000 × 8000 = 64 MP > 40 MP
      expect(inspect(pngHeader(8000, 8000))).toEqual({
        ok: false,
        reason: 'Image has more pixels than this upload kind allows.',
      });
    });

    it('an image past the edge limit', () => {
      expect(inspect(pngHeader(8001, 10))).toEqual({
        ok: false,
        reason: 'Image is wider or taller than this upload kind allows.',
      });
    });

    it('zero dimensions', () => {
      expect(inspect(pngHeader(0, 100)).ok).toBe(false);
    });

    it('a PDF declared as a PNG', () => {
      expect(inspect(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n')).ok).toBe(false);
    });

    it('an SVG declared as a PNG', () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
      );
      expect(inspect(svg)).toEqual({
        ok: false,
        reason: 'File is not a readable JPEG, PNG or WebP image.',
      });
    });

    it('an HTML page declared as a PNG', () => {
      expect(inspect(Buffer.from('<!doctype html><script>1</script>')).ok).toBe(
        false,
      );
    });

    it('a truncated 12-byte file', () => {
      expect(inspect(pngHeader(10, 10).subarray(0, 12)).ok).toBe(false);
    });

    it('a JPEG whose size marker lies past the bytes read', () => {
      expect(inspect(jpegHeader(10, 10).subarray(0, 22)).ok).toBe(false);
    });

    it('an empty header', () => {
      expect(inspect(Buffer.alloc(0)).ok).toBe(false);
    });

    it('a real JPEG declared as a PNG', () => {
      expect(inspect(jpegHeader(10, 10))).toEqual({
        ok: false,
        reason: 'File content does not match the declared content type.',
      });
    });

    it('a GIF, even declared honestly', () => {
      const gif = Buffer.from('GIF89a\x0a\x00\x0a\x00\x00\x00\x00', 'latin1');
      expect(inspect(gif, declared({ contentType: 'image/gif' })).ok).toBe(
        false,
      );
    });

    it('a stored size that differs from the declared size', () => {
      expect(inspect(pngHeader(10, 10), declared(), 999)).toEqual({
        ok: false,
        reason: 'Stored size does not match the declared size.',
      });
    });

    it('a file over the kind size limit', () => {
      const size = policy.maxSizeInBytes + 1;
      expect(inspect(pngHeader(10, 10), declared({ byteSize: size }))).toEqual({
        ok: false,
        reason: 'File is larger than this upload kind allows.',
      });
    });
  });
});
