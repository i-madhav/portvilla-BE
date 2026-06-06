import { Platform } from './platform.enum';

export interface IPlatformParser<TResult> {
  readonly platform: Platform;
  fetch(identifier: string): Promise<TResult>;
}
