import { NestFactory } from '@nestjs/core';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * Resolves which log levels are emitted.
 *
 * NestJS suppresses `debug`/`verbose` unless they are explicitly enabled, which
 * is why granular step logs never showed up before. `LOG_LEVEL=debug` (or a
 * `development` NODE_ENV) turns on the full trace; otherwise only
 * error/warn/log are emitted so production stays quiet.
 */
function resolveLogLevels(): LogLevel[] {
  const verbose: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const quiet: LogLevel[] = ['error', 'warn', 'log'];

  const explicit = process.env.LOG_LEVEL?.toLowerCase();
  if (explicit === 'debug' || explicit === 'verbose') return verbose;
  if (explicit === 'log' || explicit === 'warn' || explicit === 'error')
    return quiet;

  return process.env.NODE_ENV === 'development' ? verbose : quiet;
}

/**
 * How many reverse proxies sit in front of the API, for Express's
 * `trust proxy` — and so for `req.ip`, which is what every throttle keys on.
 *
 * Unset, Express trusts none and `req.ip` is the socket's peer. On Cloud Run
 * that peer is Google's front end, so every visitor shares one address and a
 * per-IP limit (`POST /profiles/me/generate`: five per ten minutes) becomes a
 * limit for the whole platform. Cloud Run adds exactly one hop, and appends
 * the client's address to `X-Forwarded-For` itself, so trusting one hop reads
 * that address and ignores anything a client put in the header before it.
 *
 * Production defaults to that one hop; everywhere else defaults to none,
 * because trusting a proxy that is not there lets any client choose its own
 * IP. `TRUST_PROXY_HOPS` overrides both (e.g. `2` behind a load balancer in
 * front of Cloud Run).
 */
function trustProxyHops(): number {
  const explicit = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '', 10);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return process.env.NODE_ENV === 'production' ? 1 : 0;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: resolveLogLevels(),
    // Preserve the untouched request body so the LiveKit webhook can verify its
    // signature against the exact bytes that were signed.
    rawBody: true,
  });

  // LiveKit posts webhooks as `application/webhook+json`, which the default JSON
  // parser ignores — leaving `rawBody` empty and signature verification unable to
  // run. Register the JSON parser for that content type too (rawBody is preserved).
  app.useBodyParser('json', {
    type: ['application/json', 'application/webhook+json'],
  });

  app.set('trust proxy', trustProxyHops());

  // ─── Static file serving ────────────────────────────────────────────────
  // Serves uploaded resumes and profile images at /uploads/*
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // ─── CORS ───────────────────────────────────────────────────────────────
  // In development all origins are permitted so local frontends (any port)
  // can reach the API without configuration. In all other environments the
  // origin list must be explicitly set via the CORS_ORIGINS env variable
  // (comma-separated, e.g. "https://app.portvilla.com,https://admin.portvilla.com").
  const isDevelopment = process.env.NODE_ENV === 'development';
  app.enableCors({
    origin: isDevelopment
      ? '*'
      : (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: !isDevelopment, // credentials + wildcard origin is rejected by browsers
  });

  // ─── Global prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validation ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true, // auto-transform payloads to DTO class instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger ────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Portvilla API')
    .setDescription(
      'REST API for the Portvilla platform.\n\n' +
        '**Authentication flow:**\n' +
        '1. `POST /auth/register` — create account (verification OTP dispatched)\n' +
        '2. `POST /auth/verify-email` — verify email with OTP\n' +
        '3. `POST /auth/login` — obtain access + refresh tokens\n' +
        '4. `POST /auth/refresh` — rotate tokens when access token expires\n' +
        '5. `POST /auth/logout` — revoke the refresh token',
    )
    .setVersion('1.0')
    .addBearerAuth()
    // The worker↔backend shared secret guarding GET /agent/context/:username.
    // Declared separately from the user bearer scheme so "Authorize" in Swagger
    // does not offer a service secret where an access token belongs.
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Service token as `Bearer <AGENT_SERVICE_TOKEN>`.',
      },
      'service-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Portvilla API', error);
  process.exit(1);
});
