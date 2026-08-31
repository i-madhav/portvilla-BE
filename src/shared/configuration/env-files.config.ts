/**
 * Env files, in the order `ConfigModule` reads them: the mounted secret first,
 * then a local `.env` for development.
 *
 * Shared so that standalone scripts bootstrap their configuration from exactly
 * the same sources as the running app.
 */
export const ENV_FILE_PATHS = ['/etc/secrets/portvilla-be/.env', '.env'];
