import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Logs every incoming HTTP request and its outcome.
 *
 * Applied globally (see AppModule) so it runs *before* guards — a request that
 * is rejected by an auth guard still produces a log line, which the previous
 * setup (no request logging at all) could not do.
 *
 * Level policy:
 *   - `debug` : request received  ("→ METHOD /url")
 *   - `log`   : 2xx / 3xx response ("METHOD /url 200 +12ms")
 *   - `warn`  : 4xx response       (client / auth error)
 *   - `error` : 5xx response       (server error)
 *
 * No request bodies are logged, so passwords / OTPs / tokens never reach the log.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startedAt = Date.now();

    this.logger.debug(`→ ${method} ${originalUrl}`);

    res.on('finish', () => {
      const { statusCode } = res;
      const durationMs = Date.now() - startedAt;
      const line = `${method} ${originalUrl} ${statusCode} +${durationMs}ms`;

      if (statusCode >= 500) {
        this.logger.error(line);
      } else if (statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
