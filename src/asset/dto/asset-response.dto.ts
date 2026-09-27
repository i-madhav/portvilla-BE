import { ApiProperty } from '@nestjs/swagger';

import {
  AssetKind,
  AssetStatus,
  type IAssetRecord,
} from '../domain/asset.interface';
import type { UploadTicket } from '../asset.service';

// ─── Intent response ──────────────────────────────────────────────────────────

export class UploadTicketDto {
  @ApiProperty({ example: '01K4S0V2M9T7X3QF8G2ZQ7HB4N' })
  assetId!: string;

  @ApiProperty({
    description:
      'Presigned PUT URL. Send the bytes here directly — **without** the Portvilla `Authorization` header.',
  })
  uploadUrl!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'Content-Type': 'image/png',
      'Content-Length': '842104',
      'x-amz-checksum-sha256': 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
    },
    description:
      'Send verbatim; the signature covers them. Browsers set Content-Length themselves and refuse to let script set it.',
  })
  requiredHeaders!: Record<string, string>;

  @ApiProperty({ description: 'The upload URL stops working at this time.' })
  expiresAt!: Date;

  static fromTicket(ticket: UploadTicket): UploadTicketDto {
    const dto = new UploadTicketDto();
    dto.assetId = ticket.assetId;
    dto.uploadUrl = ticket.url;
    dto.requiredHeaders = { ...ticket.requiredHeaders };
    dto.expiresAt = ticket.expiresAt;
    return dto;
  }
}

export class UploadIntentResponseDto {
  @ApiProperty({ type: [UploadTicketDto] })
  uploads!: UploadTicketDto[];
}

// ─── Asset ────────────────────────────────────────────────────────────────────

/**
 * An allowlist: storage keys, bucket, the owner id and the declared sha256
 * never leave the server.
 */
export class AssetResponseDto {
  @ApiProperty({ example: '01K4S0V2M9T7X3QF8G2ZQ7HB4N' })
  assetId!: string;

  @ApiProperty({ enum: AssetKind })
  kind!: AssetKind;

  @ApiProperty({ enum: AssetStatus })
  status!: AssetStatus;

  @ApiProperty({
    nullable: true,
    example: 'https://cdn.portvilla.com/i/01K4S0V2M9T7X3QF8G2ZQ7HB4N/l',
    description: 'Public URL of the large variant. Null until committed.',
  })
  resolvedUrl!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'image/png',
    description: 'Sniffed from the bytes.',
  })
  contentType!: string | null;

  @ApiProperty({ nullable: true, example: 842104 })
  byteSize!: number | null;

  @ApiProperty({ nullable: true, example: 1920 })
  width!: number | null;

  @ApiProperty({ nullable: true, example: 1080 })
  height!: number | null;

  @ApiProperty()
  createdAt!: Date;

  static fromRecord(record: IAssetRecord): AssetResponseDto {
    const dto = new AssetResponseDto();
    dto.assetId = record.assetId;
    dto.kind = record.kind;
    dto.status = record.status;
    dto.resolvedUrl = record.resolvedUrl;
    dto.contentType = record.actual?.contentType ?? null;
    dto.byteSize = record.actual?.byteSize ?? null;
    dto.width = record.actual?.width ?? null;
    dto.height = record.actual?.height ?? null;
    dto.createdAt = record.createdAt;
    return dto;
  }
}
