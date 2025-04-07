import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ContextType,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TelemetryLogService } from './telemetry-log.service';
import { GetUserIdFromToken } from 'src/decorator/get-auth-token.decorator';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogger');
  private startTime: number;

  constructor(private telemetryLogService: TelemetryLogService) {}

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
    const userId = ctx.getContext().req.user?.userId;
    if (!info) {
      this.logger.warn(
        'GraphQL request detected, but ctx.getInfo() is undefined.',
      );
      return next.handle();
    }

    const { operation, fieldName } = info;
    let variables = '';
    const startTime = Date.now();
    const request = ctx.getContext().req;

    try {
      variables = JSON.stringify(ctx.getContext()?.req?.body?.variables ?? {});
    } catch (error) {
      variables = '{}';
    }

    this.logger.log(
      `[GraphQL] ${operation.operation.toUpperCase()} [33m${fieldName}[39m${
        variables ? ` Variables: ${variables}` : ''
      }`,
    );

    return next.handle().pipe(
      tap({
        next: (value) => {
          const timeConsumed = Date.now() - startTime;
          this.telemetryLogService.create({
            timestamp: new Date(),
            requestMethod: operation.operation.toUpperCase(),
            endpoint: fieldName,
            input: variables,
            output: JSON.stringify(value),
            timeConsumed,
            userId,
            handler: 'GraphQL',
          });
        },
      }),
    );
  }

  private handleRestRequest(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const startTime = Date.now();

    const { method, url, body, user } = request;

    this.logger.log(
      `[REST] ${method.toUpperCase()} ${url} Body: ${JSON.stringify(body)}`,
    );

    return next.handle().pipe(
      tap({
        next: (value) => {
          const timeConsumed = Date.now() - startTime;
          this.telemetryLogService.create({
            timestamp: new Date(),
            requestMethod: method,
            endpoint: url,
            input: JSON.stringify(body),
            output: JSON.stringify(value),
            timeConsumed,
            userId: user?.id,
            handler: 'REST',
          });
        },
      }),
    );
  }
}
