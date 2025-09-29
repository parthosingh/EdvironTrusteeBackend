import { Injectable, InternalServerErrorException } from '@nestjs/common';
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

  getFileTypeFromBase64(base64String: string) {
    
    const signature = atob(base64String).slice(0, 4);
    const fileSignatures = {
      '89504E47': 'image/png',
      FFD8FFE0: 'image/jpeg', // JFIF
      FFD8FFE1: 'image/jpeg', // Exif
      FFD8FFE2: 'image/jpeg', // Canon
      '47494638': 'image/gif',
      '25504446': 'application/pdf',
      '504B0304': 'application/zip',
    };

    const hexSignature = Array.from(signature)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    return fileSignatures[hexSignature] || 'unknown';
  }
}
