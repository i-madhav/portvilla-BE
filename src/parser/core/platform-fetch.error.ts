import { Platform } from './platform.enum';

export class PlatformFetchError extends Error {
  constructor(
    public readonly platform: Platform,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformFetchError';
  }
}
