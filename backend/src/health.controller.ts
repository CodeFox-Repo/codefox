import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe for the platform.
 *
 * GraphQL cannot serve as one: Apollo rejects GET queries with a 400 unless
 * explicitly opted in, so pointing a healthcheck at /graphql marks a perfectly
 * healthy deploy as failed.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
