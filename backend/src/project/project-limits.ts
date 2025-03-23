import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { GraphQLError } from 'graphql';

export const PROJECT_DAILY_LIMIT = 3; // Maximum number of projects a user can create per day

export enum ProjectErrorCode {
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
}

export class ProjectRateLimitException extends ForbiddenException {
  constructor(limit: number) {
    super(
      `Daily project creation limit of ${limit} reached. Please try again tomorrow.`,
    );
  }

  getGraphQLError(): GraphQLError {
    return new GraphQLError(this.message, {
      extensions: {
        code: ProjectErrorCode.DAILY_LIMIT_EXCEEDED,
        limit: PROJECT_DAILY_LIMIT,
        status: HttpStatus.TOO_MANY_REQUESTS,
      },
    });
  }
}
