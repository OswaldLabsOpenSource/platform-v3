import S3 from "aws-sdk/clients/s3";
import { AWS_S3_ACCESS_KEY, AWS_S3_SECRET_KEY } from "../config";
import { ErrorCode } from "../interfaces/enum";
const s3 = new S3({
  accessKeyId: AWS_S3_ACCESS_KEY,
  secretAccessKey: AWS_S3_SECRET_KEY
});
import Fraud from "fraud";

export const temporaryStorage = new Fraud({
  directory: "./"
});

export const uploadToS3 = (
  Bucket: string,
  Key: string,
  Body: string | Buffer | Uint8Array | Blob
) =>
  new Promise((resolve, reject) => {
    s3.upload(
      {
        Bucket,
        Key,
        Body
      },
      undefined,
      (error: Error, data: S3.ManagedUpload.SendData) => {
        if (error) return reject(error);
        resolve(data);
      }
    );
  });

export const getFromS3 = (Bucket: string, Key: string) =>
  new Promise((resolve, reject) => {
    s3.getObject(
      {
        Bucket,
        Key
      },
      (error: Error, data: S3.GetObjectOutput) => {
        if (error) return reject(ErrorCode.NOT_FOUND);
        if (!data.Body) return reject(ErrorCode.NOT_FOUND);
        resolve(data.Body);
      }
    );
  });
