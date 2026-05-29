import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ─── Global prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validation ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // auto-transform payloads to DTO class instances
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Swagger docs available at http://localhost:${process.env.PORT ?? 3000}/docs`);

}

bootstrap();
