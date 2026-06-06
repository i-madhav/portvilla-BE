import { Platform } from './platform.enum';
import { IPlatformParser } from './i-platform-parser';

export type ParserInstance<T extends IPlatformParser<unknown>> = Parser<T> & T;

export class Parser<T extends IPlatformParser<unknown>> {
  private constructor(private readonly impl: T) {}

  static create<T extends IPlatformParser<unknown>>(impl: T): ParserInstance<T> {
    const instance = new Parser(impl);
    return new Proxy(instance, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const implProp = (impl as Record<string | symbol, unknown>)[prop as string];
        if (implProp !== undefined) {
          return typeof implProp === 'function' ? implProp.bind(impl) : implProp;
        }
      },
    }) as ParserInstance<T>;
  }

  fetch(identifier: string) {
    return this.impl.fetch(identifier);
  }

  get platform(): Platform {
    return this.impl.platform;
  }
}
