import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

import { ASSET_LIMITS, AssetKind } from '../domain/asset.interface';

/**
 * Shape checks only. Per-kind rules (allowed types, size ceiling) live in the
 * policy table and are applied by the service, so there is one source of truth.
 */
export class UploadFileDto {
  @ApiProperty({ enum: AssetKind, example: AssetKind.WORK_IMAGE })
  @IsEnum(AssetKind)
  kind!: AssetKind;

  @ApiProperty({
    example: 'screenshot-1.png',
    description:
      'Stored as evidence only. It never appears in a storage key and is sanitised before use in any header.',
  })
  @IsString()
  @Length(1, 255)
  // No control characters (CR/LF header injection, NUL, etc.) and no path separators.
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  @Matches(/^[^\x00-\x1f\x7f/\\]+$/, {
    message: 'filename must not contain control characters or path separators.',
  })
  filename!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @Length(1, 100)
  contentType!: string;

  @ApiProperty({ example: 842104, description: 'Exact size in bytes.' })
  @IsInt()
  @Min(1)
  byteSize!: number;

  @ApiProperty({
    example: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    description:
      'Hex SHA-256 of the exact bytes to be uploaded (`crypto.subtle.digest`). Storage rejects any upload that does not hash to it.',
  })
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'sha256 must be 64 hex characters.',
  })
  sha256!: string;
}

export class CreateUploadIntentDto {
  @ApiProperty({ type: [UploadFileDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ASSET_LIMITS.filesPerIntent)
  @ValidateNested({ each: true })
  @Type(() => UploadFileDto)
  files!: UploadFileDto[];
}
