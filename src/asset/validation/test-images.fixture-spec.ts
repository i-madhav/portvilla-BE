/**
 * Hand-built image headers for the asset specs. Only the header matters —
 * the sniffer never decodes pixels — so each is the smallest byte sequence a
 * real parser accepts, with the dimensions we want to claim.
 *
 * Named `*.fixture-spec.ts` so the build excludes it (`**\/*spec.ts`) while
 * Jest does not mistake it for a suite (`*.spec.ts`).
 */

export function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8); // IHDR length
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8; // bit depth
  header[25] = 6; // RGBA
  return header;
}

export function jpegHeader(width: number, height: number): Buffer {
  const app0 = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(19);
  sof0.writeUInt16BE(0xffc0, 0);
  sof0.writeUInt16BE(17, 2);
  sof0[4] = 8; // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3; // components
  return Buffer.concat([app0, sof0]);
}

export function webpHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(30);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(22, 4);
  header.write('WEBP', 8, 'ascii');
  header.write('VP8X', 12, 'ascii');
  header.writeUInt32LE(10, 16);
  header.writeUIntLE(width - 1, 24, 3);
  header.writeUIntLE(height - 1, 27, 3);
  return header;
}

/** A header followed by filler, so the object has a realistic size. */
export function imageOfSize(header: Buffer, byteSize: number): Buffer {
  const body = Buffer.alloc(byteSize);
  header.copy(body, 0);
  return body;
}
