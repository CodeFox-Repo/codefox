// src/github/github-app.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import { readFileSync } from 'fs';
import { AppConfigService } from 'src/config/config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';
import { Project } from 'src/project/project.model';

@Injectable()
export class GitHubAppService {
  private readonly logger = new Logger(GitHubAppService.name);

  private readonly app: App;

  //For local testing. You must use smee
  //smee -u https://smee.io/asdasd -t http://127.0.0.1:8080/github/webhook

  constructor(
    private configService: AppConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    const githubEnabled = this.configService.get<string>('GITHUB_ENABLED');
    if (githubEnabled !== 'true') {
      this.logger.warn('GitHub APP Service integration is disabled');
      return;
    }
    // Load from environment or config
    const config = this.configService.githubConfig;
    const appId = config.appId;
    const privateKeyPath = config.privateKeyPath;
    const secret = config.webhookSecret;
    const enterpriseHostname = ''; // Not supporting enterprise for now

    // Read the private key from file
    const privateKey = readFileSync(privateKeyPath, 'utf8');

    // Instantiate the GitHub App
    if (enterpriseHostname) {
      // Use custom hostname ONLY if it's non-empty
      this.app = new App({
        appId,
        privateKey,
        webhooks: { secret },
        Octokit: Octokit.defaults({
          baseUrl: `https://${enterpriseHostname}/api/v3`,
        }),
      });
    } else {
      this.app = new App({
        appId,
        privateKey,
        webhooks: { secret },
      });
    }

    // Optional: see who you're authenticated as
    this.app.octokit
      .request('/app')
      .then((res) => {
        this.logger.log(`Authenticated as GitHub App: ${res.data.name}`);
      })
      .catch((err) => {
        this.logger.error('Error fetching app info', err);
      });

    // Handle when github remove
    this.app.webhooks.on('installation.deleted', async ({ payload }) => {
      this.logger.log(
        `Received 'installation.deleted' event: installationId=${payload.installation.id}`,
      );
      const installationId = payload.installation.id.toString();

      this.logger.log(
        `uninstall Created: installationId=${installationId}, GitHub Login=`,
      );

      // remove user github code and installationId
      await this.userRepo.update(
        { githubInstallationId: installationId },
        { githubInstallationId: null, githubAccessToken: null },
      );

      this.logger.log(`Cleared installationId for user: ${installationId}`);
    });

    // Handle when github repo removed
    this.app.webhooks.on('installation_repositories', async ({ payload }) => {
      this.logger.log(
        `Received 'installation_repositories' event: installationId=${payload.installation.id}`,
      );

      const removedRepos = payload.repositories_removed;
      if (!removedRepos || removedRepos.length === 0) {
        this.logger.log('No repositories removed.');
        return;
      }

      for (const repo of removedRepos) {
        const repoName = repo.name;
        const repoOwner = payload.installation.account.name;

        this.logger.log(`Removing repo: ${repoOwner}/${repoName}`);

        // Find project with matching githubRepoName and githubOwner
        const project = await this.projectRepo.findOne({
          where: {
            githubRepoName: repoName,
            githubOwner: repoOwner,
          },
        });

        if (!project) {
          this.logger.warn(
            `Project not found for repo ${repoOwner}/${repoName}`,
          );
          continue;
        }

        // Update the project: clear sync data
        project.isSyncedWithGitHub = false;
        project.githubRepoName = null;
        project.githubRepoUrl = null;
        project.githubOwner = null;

        await this.projectRepo.save(project);
        this.logger.log(`Cleared GitHub sync info for project: ${project.id}`);
      }
    });

    // Handle errors
    this.app.webhooks.onError((error) => {
      if (error.name === 'AggregateError') {
        this.logger.error(
          `Webhook signature verification failed: ${error.event}`,
        );
      } else {
        this.logger.error(error);
      }
    });

    // only for webhooks debugging
    this.app.webhooks.onAny(async (event) => {
      this.logger.log(
        `onAny: Received event='${event.name}' action='${event.payload}'`,
      );
    });
  }

  /**
   * Expose a getter so you can retrieve the underlying App instance if needed
   */
  getApp(): App {
    return this.app;
  }
}
