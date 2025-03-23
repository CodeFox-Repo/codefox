import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { ProjectService } from '../project/project.service';

/**
 * This guard checks if the user is authorized to access a project.
 */
@Injectable()
export class ProjectGuard implements CanActivate {
  private readonly logger = new Logger('ProjectGuard');

  constructor(
    private readonly projectsService: ProjectService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();

    // Verify and decode JWT token
    const user = await this.validateToken(request);

    // Extract project identifier from arguments
    const projectIdentifier = this.extractProjectIdentifier(args);

    if (!projectIdentifier) {
      this.logger.debug('No project identifier found in request');
      return true; // Skip check if no project identifier is found
    }

    // Validate project ownership
    await this.validateProjectOwnership(projectIdentifier, user.userId);

    // Store user in request context for later use
    request.user = user;
    return true;
  }

  private async validateToken(request: any): Promise<any> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    const token = authHeader.split(' ')[1];
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractProjectIdentifier(args: any): string | undefined {
    // Handle different input formats
    if (args.projectId) return args.projectId;
    if (args.input?.projectId) return args.input.projectId;
    if (args.isValidProject?.projectId) return args.isValidProject.projectId;
    if (args.projectPath) return args.projectPath;
    if (args.input?.projectPath) return args.input.projectPath;
    if (args.isValidProject?.projectPath)
      return args.isValidProject.projectPath;

    return undefined;
  }

  private async validateProjectOwnership(
    projectIdentifier: string,
    userId: number,
  ): Promise<void> {
    let project;
    try {
      project = await this.projectsService.getProjectById(projectIdentifier);
    } catch (error) {
      this.logger.error(`Failed to fetch project: ${error.message}`);
      throw new UnauthorizedException('Project not found');
    }

    if (!project) {
      throw new UnauthorizedException('Project not found');
    }

    if (project.userId !== userId) {
      this.logger.warn(
        `Unauthorized access attempt: User ${userId} tried to access project ${projectIdentifier}`,
      );
      throw new UnauthorizedException(
        'User is not authorized to access this project',
      );
    }
  }
}
