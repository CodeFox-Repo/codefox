import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { existsSync, mkdirSync, createWriteStream } from 'fs-extra';
import { finished } from 'stream/promises';
import { getRootDir } from 'codefox-common';
import { FileUpload } from 'graphql-upload-minimal';
import * as fs from 'fs';
import { AppConfigService } from 'src/config/config.service';
export interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class UploadService {
  private s3Client: S3Client | null = null;
  private readonly mediaDir: string;

  constructor(private configService: AppConfigService) {
    // Initialize S3 client if configurations are available
    if (this.configService.hasS3Configured) {
      const s3Config = this.configService.s3Config;
      this.s3Client = new S3Client({
        region: s3Config.region,
        endpoint: this.getEndpoint(),
        credentials: {
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
        },
      });
    }

    // Initialize media directory for local storage
    this.mediaDir = path.join(getRootDir(), 'media');
    if (!existsSync(this.mediaDir)) {
      mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  /**
   * Get the S3 endpoint URL based on configuration
   * Constructs the endpoint from account ID if not explicitly provided
   * @returns The S3 endpoint URL string
   */
  private getEndpoint(): string {
    const s3Config = this.configService.s3Config;

    // Use explicit endpoint if provided
    if (s3Config.endpoint) {
      return s3Config.endpoint;
    }

    // Construct endpoint from account ID for Cloudflare R2
    if (s3Config.accountId) {
      return `https://${s3Config.accountId}.r2.cloudflarestorage.com`;
    }

    // Fallback to default Cloudflare endpoint (should not reach here if hasS3Configured is properly checked)
    return 'https://r2.cloudflarestorage.com';
  }

  /**
   * Upload a file to either S3/Cloudflare R2 or local storage based on configuration
   * @param file File to upload (can be a GraphQL FileUpload or a Buffer)
   * @param mimetype File mimetype (required when uploading a Buffer)
   * @param subdirectory Directory path to store the file in
   * @returns Promise with the upload result
   */
  async upload(
    file: FileUpload | Buffer,
    mimetype?: string,
    subdirectory: string = 'uploads',
  ): Promise<UploadResult> {
    // Generate filename
    const fileExtension = mimetype?.split('/')[1] || 'jpg';
    const filename = `${uuidv4()}.${fileExtension}`;
    const key = `${subdirectory}/${filename}`;

    // Handle different file input types
    if (Buffer.isBuffer(file)) {
      // Direct buffer upload
      if (!mimetype) {
        throw new Error('Mimetype is required when uploading a buffer');
      }

      if (this.s3Client) {
        // Upload to S3/Cloudflare R2
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.configService.s3Config.bucketName,
            Key: key,
            Body: file,
            ContentType: mimetype,
          }),
        );

        // Get the appropriate URL for the uploaded file
        const bucketUrl = this.getBucketUrl();

        return { url: path.join(bucketUrl, key), key };
      } else {
        // Upload to local storage from buffer
        const directory = path.join(this.mediaDir, subdirectory);
        if (!existsSync(directory)) {
          mkdirSync(directory, { recursive: true });
        }

        const filePath = path.join(directory, filename);

        try {
          await fs.promises.writeFile(filePath, file);
          return { url: `/media/${key}`, key };
        } catch (error) {
          throw new Error(`Failed to upload file: ${error.message}`);
        }
      }
    } else {
      // GraphQL FileUpload
      const { createReadStream, mimetype: fileMimetype } = await file;

      if (this.s3Client) {
        // Convert stream to buffer and upload to S3/Cloudflare R2
        const buffer = await this.streamToBuffer(createReadStream());

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.configService.s3Config.bucketName,
            Key: key,
            Body: buffer,
            ContentType: fileMimetype,
          }),
        );

        // Get the appropriate URL for the uploaded file
        const bucketUrl = this.getBucketUrl();
        return { url: path.join(bucketUrl, key), key };
      } else {
        // Upload to local storage using stream
        const directory = path.join(this.mediaDir, subdirectory);
        if (!existsSync(directory)) {
          mkdirSync(directory, { recursive: true });
        }

        const filePath = path.join(directory, filename);
        const writeStream = createWriteStream(filePath);

        createReadStream().pipe(writeStream);

        try {
          await finished(writeStream);
          return { url: `/media/${key}`, key };
        } catch (error) {
          throw new Error(`Failed to upload file: ${error.message}`);
        }
      }
    }
  }

  /**
   * Convert a readable stream to a buffer
   * @param stream Readable stream
   * @returns Promise with buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Get the bucket URL to use in the returned file URL
   * @returns The bucket URL string
   */
  private getBucketUrl(): string {
    const s3Config = this.configService.s3Config;

    // If a public URL is configured, use it (e.g., CDN or custom domain)
    if (s3Config.publicUrl) {
      return s3Config.publicUrl;
    }

    // Use the constructed endpoint + bucket name
    const endpoint = this.getEndpoint();
    return `${endpoint}/${s3Config.bucketName}`;
  }
}
