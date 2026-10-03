import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { S3 } from './storage.constants';

const SIGN_EXPIRES_IN = 900;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(@Inject(S3) private readonly s3Client: S3Client) {}

  public async ensureBucket(bucket: string) {
    const command = new CreateBucketCommand({ Bucket: bucket });

    try {
      return await this.s3Client.send(command);
    } catch (error: unknown) {
      if (error instanceof BucketAlreadyOwnedByYou) {
        return;
      }

      this.logger.error(error);
      throw error;
    }
  }

  public async removeBucket(bucket: string) {
    const command = new DeleteBucketCommand({ Bucket: bucket });

    try {
      return await this.s3Client.send(command);
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  public async presignUpload(bucket: string, key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: SIGN_EXPIRES_IN,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  public async presignDownload(bucket: string, key: string) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: SIGN_EXPIRES_IN,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  public async exists(bucket: string, key: string) {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);

      return true;
    } catch (error: unknown) {
      if (error instanceof NotFound) {
        return false;
      }

      this.logger.error(error);
      throw error;
    }
  }

  public async head(bucket: string, key: string) {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      return await this.s3Client.send(command);
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  public async remove(bucket: string, key: string) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      return await this.s3Client.send(command);
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }
}
