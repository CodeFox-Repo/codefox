// src/github/github.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from 'src/config/config.service';
import { Project } from 'src/project/project.model';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  private readonly appId: string;
  private privateKey: string;
  private ignored = ['node_modules', '.git', '.gitignore', '.env'];

  constructor(
    private configService: AppConfigService,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
  ) {
    this.appId = this.configService.githubAppId;

    const privateKeyPath = this.configService.githubPrivateKeyPath;

    if (!privateKeyPath) {
      throw new Error(
        'GitHub private key path is not set in environment variables',
      );
    }

    this.logger.log(`Reading GitHub private key from: ${privateKeyPath}`);

    this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    if (!this.privateKey) {
      throw new Error('GitHub private key is missing!');
    }
  }

  /**
   * 1) Generate a JWT for your GitHub App using the private key.
   * 2) Use that JWT to get an installation access token.
   *    This token allows you to act on behalf of a particular installation (user/org).
   */
  async getInstallationToken(installationId: string): Promise<string> {
    // 1) Create a JWT (valid for ~10 minutes)
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now, // Issued at time
      exp: now + 600, // JWT expiration (10 minute maximum)
      iss: this.appId, // Your GitHub App's App ID
    };

    const gitHubAppJwt = jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
    });

    // 2) Exchange JWT for an installation token
    const tokenUrl = `https://api.github.com/app/installations/${installationId}/access_tokens`;

    const response = await axios.post(
      tokenUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${gitHubAppJwt}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    const token = response.data.token;
    return token;
  }

  async exchangeOAuthCodeForToken(code: string): Promise<string> {
    const clientId = this.configService.githubClientId;
    const clientSecret = this.configService.githubClientSecret;

    console.log('Exchanging OAuth Code:', {
      code,
      clientId,
      clientSecretExists: !!clientSecret,
    });

    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      console.log('GitHub Token Exchange Response:', response.data);

      if (response.data.error) {
        console.error('GitHub OAuth error:', response.data);
        throw new BadRequestException(
          `GitHub OAuth error: ${response.data.error_description}`,
        );
      }

      const accessToken = response.data.access_token;
      if (!accessToken) {
        throw new Error(
          'GitHub token exchange failed: No access token returned.',
        );
      }

      return accessToken;
    } catch (error: any) {
      console.error(
        'OAuth exchange failed:',
        error.response?.data || error.message,
      );
      // throw new Error(`GitHub OAuth exchange failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Create a new repository under the *user's* account.
   * If you need an org-level repo, use POST /orgs/{org}/repos.
   */
  async createUserRepo(
    repoName: string,
    isPublic: boolean,
    userOAuthToken: string,
  ): Promise<{
    owner: string;
    repo: string;
    htmlUrl: string;
  }> {
    const url = `https://api.github.com/user/repos`;

    const response = await axios.post(
      url,
      {
        name: repoName,
        private: !isPublic, // false => public, true => private
      },
      {
        headers: {
          Authorization: `token ${userOAuthToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    // The response will have data about the new repo
    const data = response.data;
    return {
      owner: data.owner.login, // e.g. "octocat"
      repo: data.name, // e.g. "my-new-repo"
      htmlUrl: data.html_url, // e.g. "https://github.com/octocat/my-new-repo"
    };
  }

  async pushMultipleFiles(
    installationToken: string,
    owner: string,
    repo: string,
    files: string[],
  ) {
    for (const file of files) {
      const fileName = path.basename(file);
      await this.pushFileContent(
        installationToken,
        owner,
        repo,
        file,
        `myFolder/${fileName}`,
        'Initial commit of file ' + fileName,
      );
    }
  }

  /**
   * Push a single file to the given path in the repo using GitHub Contents API.
   *
   * @param relativePathInRepo e.g. "backend/index.js" or "frontend/package.json"
   */
  async pushFileContent(
    installationToken: string,
    owner: string,
    repo: string,
    localFilePath: string,
    relativePathInRepo: string,
    commitMessage: string,
  ) {
    const fileBuffer = fs.readFileSync(localFilePath);
    const base64Content = fileBuffer.toString('base64');

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${relativePathInRepo}`;

    await axios.put(
      url,
      {
        message: commitMessage,
        content: base64Content,
      },
      {
        headers: {
          Authorization: `token ${installationToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    this.logger.log(
      `Pushed file: ${relativePathInRepo} -> https://github.com/${owner}/${repo}`,
    );
  }

  /**
   * Recursively push all files in a local folder to the repo.
   * Skips .git, node_modules, etc. (configurable)
   */
  async pushFolderContent(
    installationToken: string,
    owner: string,
    repo: string,
    folderPath: string,
    basePathInRepo: string, // e.g. "" or "backend"
  ) {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip unwanted files
      if (this.ignored.includes(entry.name)) {
        continue;
      }

      const entryPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        // Skip unwanted directories
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }
        // Recurse into subdirectory
        const subDirInRepo = path
          .join(basePathInRepo, entry.name)
          .replace(/\\/g, '/');
        await this.pushFolderContent(
          installationToken,
          owner,
          repo,
          entryPath,
          subDirInRepo,
        );
      } else {
        // It's a file; push it
        const fileInRepo = path
          .join(basePathInRepo, entry.name)
          .replace(/\\/g, '/');
        await this.pushFileContent(
          installationToken,
          owner,
          repo,
          entryPath,
          fileInRepo,
          `Add file: ${fileInRepo}`,
        );
      }
    }
  }
}
