import { ApiProperty } from '@nestjs/swagger';

import { SessionStatus, SessionType } from '../session.interface';

export class ActivityTotalsDto {
  @ApiProperty({
    description:
      'All-time conversations (ACTIVE or ENDED only — never PENDING).',
  })
  conversations!: number;

  @ApiProperty({
    description: 'Summed duration of completed conversations, in seconds.',
  })
  totalDurationSec!: number;

  @ApiProperty({
    nullable: true,
    description:
      'Mean completed-conversation duration in seconds, or null when none have ended.',
  })
  avgDurationSec!: number | null;
}

export class ActivityLast7dDto {
  @ApiProperty() conversations!: number;

  @ApiProperty({
    description:
      'Change vs. the prior 7-day window (this window minus previous).',
  })
  deltaVsPrior7d!: number;
}

export class RecentSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({
    nullable: true,
    description: 'Duration in seconds, or null if not yet ended.',
  })
  durationSec!: number | null;
  @ApiProperty({ enum: SessionStatus }) status!: SessionStatus;
  @ApiProperty({ enum: SessionType }) type!: SessionType;
}

export class DailyBucketDto {
  @ApiProperty({ example: '2026-07-18' }) date!: string;
  @ApiProperty() count!: number;
}

export class SessionActivityDto {
  @ApiProperty({ type: ActivityTotalsDto }) totals!: ActivityTotalsDto;
  @ApiProperty({ type: ActivityLast7dDto }) last7d!: ActivityLast7dDto;
  @ApiProperty({ type: [RecentSessionDto] }) recent!: RecentSessionDto[];
  @ApiProperty({
    type: [DailyBucketDto],
    description: '14 zero-filled UTC day buckets, oldest first.',
  })
  daily!: DailyBucketDto[];
}
