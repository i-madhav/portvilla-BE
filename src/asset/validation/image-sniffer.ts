import { imageSize } from 'image-size';
import {
  ActualFile,
  AssetPolicy,
  DeclaredFile,
} from '../domain/asset.interface';

/** `image-size` reports a short format name; map the ones we accept to MIME types. Anything unmapped is rejected. */
const MIME_BY_SNIFFED_TYPE: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type InspectionResult =
  | { ok: true; actual: ActualFile }
  | { ok: false; reason: string };

/**
 * Decides whether an uploaded object may be promoted, from evidence only.
 *
 * `header` is the first few hundred KiB of the object — never the whole file.
 * The format comes from magic bytes and the dimensions from the file header,
 * so a 60 KB PNG declaring 40000 × 40000 (a decompression bomb) is refused
 * without ever being decoded. Pure, so the security core is unit-testable.
 *
 * Reasons are fixed strings: they are stored and returned to the client, so
 * nothing the client sent is echoed back.
 */
export function inspectUpload(
  policy: AssetPolicy,
  declared: DeclaredFile,
  storedByteSize: number,
  header: Buffer,
): InspectionResult {
  // The signed Content-Length should make these impossible; they are checked
  // anyway because the storage signature is the one control we cannot unit-test.
  if (storedByteSize !== declared.byteSize) {
    return reject('Stored size does not match the declared size.');
  }
  if (storedByteSize > policy.maxSizeInBytes) {
    return reject('File is larger than this upload kind allows.');
  }

  const sniffed = sniff(header);
  if (!sniffed) {
    return reject('File is not a readable JPEG, PNG or WebP image.');
  }
  if (!policy.allowedContentTypes.includes(sniffed.contentType)) {
    return reject('File type is not allowed for this upload kind.');
  }
  if (sniffed.contentType !== declared.contentType) {
    return reject('File content does not match the declared content type.');
  }

  const { width, height } = sniffed;
  if (width < 1 || height < 1) {
    return reject('Image has no dimensions.');
  }
  if (policy.maxEdge !== null && Math.max(width, height) > policy.maxEdge) {
    return reject('Image is wider or taller than this upload kind allows.');
  }
  if (policy.maxPixels !== null && width * height > policy.maxPixels) {
    return reject('Image has more pixels than this upload kind allows.');
  }

  return {
    ok: true,
    actual: {
      contentType: sniffed.contentType,
      byteSize: storedByteSize,
      width,
      height,
    },
  };
}

function sniff(
  header: Buffer,
): { contentType: string; width: number; height: number } | null {
  try {
    const { type, width, height } = imageSize(header);
    const contentType = type ? MIME_BY_SNIFFED_TYPE[type] : undefined;
    // `imageSize` returns `undefined` dimensions for some partial inputs
    // instead of throwing; treat that the same as unreadable.
    if (!contentType || !Number.isInteger(width) || !Number.isInteger(height)) {
      return null;
    }
    return { contentType, width, height };
  } catch {
    // Unknown format, truncated header, or dimensions past the bytes we read.
    return null;
  }
}

function reject(reason: string): InspectionResult {
  return { ok: false, reason };
}
