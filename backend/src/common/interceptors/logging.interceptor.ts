import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ContextType,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql';

/** Keys whose value must never reach a log line, at any depth. */
const SECRET = /password|token|secret|authorization|apikey|api_key/i;

/** Anything longer than this is a payload, not a log line. */
const MAX_VALUE = 200;

/**
 * A request body as it is safe to print.
 *
 * Variables and bodies used to be stringified whole, which put every login's
 * plaintext password into the deploy's logs and every pasted image into them
 * as megabytes of base64.
 */
const safe = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') {
    return value.length > MAX_VALUE
      ? `${value.slice(0, MAX_VALUE)}…(${value.length})`
      : value;
  }
  if (Array.isArray(value)) {
    return depth > 4 ? '[…]' : value.map((item) => safe(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (depth > 4) return '{…}';
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET.test(key) ? '[redacted]' : safe(item, depth + 1),
      ]),
    );
  }
  return value;
};

const describe = (value: unknown): string => {
  try {
    return JSON.stringify(safe(value) ?? {});
  } catch {
    return '{}';
  }
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    this.logger.debug(`Intercepting request, Context Type: ${contextType}`);

    if (contextType === ('graphql' as ContextType)) {
      return this.handleGraphQLRequest(context, next);
    } else if (contextType === 'http') {
      return this.handleRestRequest(context, next);
    } else {
      this.logger.warn('Unknown request type, skipping logging.');
      return next.handle();
    }
  }

  private handleGraphQLRequest(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    if (!info) {
      this.logger.warn(
        'GraphQL request detected, but ctx.getInfo() is undefined.',
      );
      return next.handle();
    }

    const { operation, fieldName } = info;
    const variables = describe(ctx.getContext()?.req?.body?.variables);

    this.logger.log(
      `[GraphQL] ${operation.operation.toUpperCase()} \x1B[33m${fieldName}\x1B[39m${
        variables ? ` Variables: ${variables}` : ''
      }`,
    );

    return next.handle();
  }

  private handleRestRequest(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    const { method, url, body } = request;

    this.logger.log(
      `[REST] ${method.toUpperCase()} ${url} Body: ${describe(body)}`,
    );

    return next.handle();
  }
}
