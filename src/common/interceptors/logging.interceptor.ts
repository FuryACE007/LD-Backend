import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const start = process.hrtime.bigint();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection?.remoteAddress;
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.headers['x-request-id'] = requestId; // propagate if downstream needs it

    // Avoid logging sensitive bodies; log size only for POST/PUT/PATCH
    const bodySize = ['POST', 'PUT', 'PATCH'].includes(method)
      ? Buffer.byteLength(JSON.stringify(sanitizeBody(req.body ?? {})))
      : 0;

    this.logger.log(
      `[${requestId}] -> ${method} ${url} from ${ip} body=${bodySize}B`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
          this.logger.log(
            `[${requestId}] <- ${method} ${url} status=${res.statusCode} ${durationMs}ms`,
          );
        },
        error: (err) => {
          const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
          this.logger.error(
            `[${requestId}] !! ${method} ${url} status=${res.statusCode} ${durationMs}ms: ${err?.message}`,
            err?.stack,
          );
        },
      }),
    );
  }
}

function sanitizeBody(body: any): any {
  // Redact obvious secrets and large blobs to keep logs lean
  const redactedKeys = ['mnemonics', 'mnemonic', 'secret', 'privateKey', 'accessToken'];
  try {
    const clone: any = {};
    for (const key of Object.keys(body || {})) {
      if (redactedKeys.includes(key)) {
        clone[key] = '[REDACTED]';
      } else {
        const val = body[key];
        // Cap arrays/strings to avoid log bloat
        if (Array.isArray(val)) clone[key] = `[array(${val.length})]`;
        else if (typeof val === 'string' && val.length > 256)
          clone[key] = `[string(${val.length})]`;
        else clone[key] = val;
      }
    }
    return clone;
  } catch {
    return {};
  }
}