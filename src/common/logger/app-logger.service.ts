import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sensitiveKeys = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  log(message: any, context?: string) {
    const formatted = typeof message === 'object' ? JSON.stringify(this.sanitizeData(message), null, 2) : message;
    super.log(formatted, context);
  }

  error(message: any, stack?: string, context?: string) {
    const formatted = typeof message === 'object' ? JSON.stringify(this.sanitizeData(message), null, 2) : message;
    super.error(formatted, stack, context);
  }

  warn(message: any, context?: string) {
    const formatted = typeof message === 'object' ? JSON.stringify(this.sanitizeData(message), null, 2) : message;
    super.warn(formatted, context);
  }

  debug(message: any, context?: string) {
    const formatted = typeof message === 'object' ? JSON.stringify(this.sanitizeData(message), null, 2) : message;
    super.debug(formatted, context);
  }
}
