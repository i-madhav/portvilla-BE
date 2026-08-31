import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AGENT_SERVICE_TOKEN_ENV,
  ServiceTokenGuard,
} from './service-token.guard';

const TOKEN = 'a'.repeat(32);

/** A ConfigService that knows one key — enough for this guard. */
function configWith(token: string | undefined): ConfigService {
  return {
    getOrThrow: (key: string): string => {
      if (key !== AGENT_SERVICE_TOKEN_ENV || token === undefined) {
        throw new Error(`Configuration key "${key}" does not exist`);
      }
      return token;
    },
  } as unknown as ConfigService;
}

function requestWith(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/api/v1/agent/context/jane',
        headers: authorization === undefined ? {} : { authorization },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard', () => {
  describe('construction', () => {
    it('refuses to start when the token is not configured', () => {
      expect(() => new ServiceTokenGuard(configWith(undefined))).toThrow();
    });

    it('refuses to start on a token short enough to guess', () => {
      expect(() => new ServiceTokenGuard(configWith('short'))).toThrow(
        /at least 24 characters/,
      );
    });

    it('starts on a token of sufficient length', () => {
      expect(() => new ServiceTokenGuard(configWith(TOKEN))).not.toThrow();
    });
  });

  describe('canActivate', () => {
    const guard = new ServiceTokenGuard(configWith(TOKEN));

    it('admits the configured token', () => {
      expect(guard.canActivate(requestWith(`Bearer ${TOKEN}`))).toBe(true);
    });

    it('admits a case-insensitive scheme', () => {
      expect(guard.canActivate(requestWith(`bearer ${TOKEN}`))).toBe(true);
    });

    it.each([
      ['no header', undefined],
      ['an empty header', ''],
      ['the scheme alone', 'Bearer'],
      ['a bare token with no scheme', TOKEN],
      ['the wrong scheme', `Basic ${TOKEN}`],
      ['trailing junk after the token', `Bearer ${TOKEN} extra`],
    ])('rejects %s', (_label, header) => {
      expect(() => guard.canActivate(requestWith(header))).toThrow(
        UnauthorizedException,
      );
    });

    it.each([
      ['a different token', 'b'.repeat(32)],
      ['a prefix of the token', TOKEN.slice(0, -1)],
      ['the token plus a character', `${TOKEN}a`],
      ['a case variant', TOKEN.toUpperCase()],
    ])('rejects %s', (_label, presented) => {
      expect(() =>
        guard.canActivate(requestWith(`Bearer ${presented}`)),
      ).toThrow(UnauthorizedException);
    });

    it('never echoes the presented token in the rejection', () => {
      try {
        guard.canActivate(requestWith('Bearer wrong-token-value'));
        fail('expected the guard to reject');
      } catch (error) {
        expect(JSON.stringify(error)).not.toContain('wrong-token-value');
      }
    });
  });
});
