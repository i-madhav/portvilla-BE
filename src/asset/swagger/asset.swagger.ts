import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { CreateUploadIntentDto } from '../dto/create-upload-intent.dto';
import {
  AssetResponseDto,
  UploadIntentResponseDto,
} from '../dto/asset-response.dto';

const UNAVAILABLE = ApiResponse({
  status: HttpStatus.SERVICE_UNAVAILABLE,
  description: 'Object storage is not configured on this server.',
});

// ─── POST /assets/uploads ─────────────────────────────────────────────────────

export const CreateUploadIntentEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Start an upload (phase 1 of 3)',
      description:
        'Declares up to 10 files and returns one presigned PUT URL per file.\n\n' +
        '1. **This call** — declare `kind`, `filename`, `contentType`, exact `byteSize` and hex `sha256`.\n' +
        '2. **PUT the bytes** to each `uploadUrl` with `requiredHeaders`, and **without** the Portvilla ' +
        '`Authorization` header. The signature covers type, size and digest, so storage rejects anything else.\n' +
        '3. **`POST /assets/uploads/{assetId}/commit`** to validate the real bytes and publish.\n\n' +
        'The batch is accepted or refused as a whole. Upload URLs expire after 5 minutes; commit is ' +
        'accepted for 1 hour after this call.',
    }),
    ApiBody({ type: CreateUploadIntentDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Upload URLs issued.',
      type: UploadIntentResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        "Malformed body, a content type not allowed for the kind, or a file over the kind's size limit.",
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid access token.',
    }),
    ApiResponse({
      status: HttpStatus.TOO_MANY_REQUESTS,
      description:
        'Rate limit (20 requests / minute), or a per-user quota: 25 uploads in progress, 300 assets, 500 MB.',
    }),
    UNAVAILABLE,
  );

// ─── POST /assets/uploads/:assetId/commit ─────────────────────────────────────

export const CommitUploadEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Validate and publish an upload (phase 3 of 3)',
      description:
        'Reads the header of the uploaded object — never the whole file — and checks the real format ' +
        "(magic bytes) and real dimensions against the kind's policy. On success the object is copied " +
        'to the delivery bucket with its content type taken from the bytes, not from the declaration.\n\n' +
        'Idempotent: committing an already-committed asset returns it again.',
    }),
    ApiParam({ name: 'assetId', example: '01K4S0V2M9T7X3QF8G2ZQ7HB4N' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Committed.',
      type: AssetResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid access token.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description:
        'No such asset, or it belongs to someone else — deliberately indistinguishable.',
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description:
        'The bytes have not arrived in storage yet. Retry after the PUT completes.',
    }),
    ApiResponse({
      status: HttpStatus.GONE,
      description: 'The commit window closed. Start a new upload.',
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description:
        'The bytes failed validation (wrong real type, too many pixels, size mismatch…). The upload is discarded.',
    }),
    UNAVAILABLE,
  );

// ─── Local-disk stand-ins (development only) ──────────────────────────────────

/** Hidden from the public docs: these exist only when storage is local disk. */
export const LocalStorageEndpoint = (): MethodDecorator =>
  applyDecorators(ApiExcludeEndpoint());
