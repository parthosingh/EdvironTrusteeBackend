import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
@Injectable()
export class AwsS3Service {
  private s3Bucket: AWS.S3;
  constructor() {
    if (process.env.NODE_ENV !== 'test')
      this.s3Bucket = new AWS.S3({
        region: 'ap-south-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
  }

  async uploadToS3(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    bucketName: string,
  ): Promise<string> {
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    };

    await this.s3Bucket.upload(params).promise();

    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  }

  async deleteFromS3(key: string, bucketName: string) {
    try {
      const params = {
        Bucket: bucketName,
        Key: key,
      };
      await this.s3Bucket.deleteObject(params).promise();
      return 'File removed successfully from S3';
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }
}
