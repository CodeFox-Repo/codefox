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
    let variables = '';

    try {
      variables = JSON.stringify(ctx.getContext()?.req?.body?.variables ?? {});
    } catch (error) {
      variables = '{}';
    }

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
      `[REST] ${method.toUpperCase()} ${url} Body: ${JSON.stringify(body)}`,
    );

    return next.handle();
  }
}
