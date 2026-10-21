import {
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  type S3Client,
} from "@aws-sdk/client-s3";

export interface CopyObjectBetweenClientsArgs {
  sourceClient: S3Client;
  sourceBucket: string;
  sourceKey: string;
  targetClient: S3Client;
  targetBucket: string;
  targetKey: string;
  contentType?: string;
}

export interface CopyObjectBetweenClientsResult {
  sizeBytes: number;
  eTag?: string;
}

/**
 * Streams an object directly between two S3 clients without buffering the entire
 * object in memory or writing to local disk.
 */
export async function copyObjectBetweenClients(
  args: CopyObjectBetweenClientsArgs,
): Promise<CopyObjectBetweenClientsResult> {
  const getResult = await args.sourceClient.send(
    new GetObjectCommand({
      Bucket: args.sourceBucket,
      Key: args.sourceKey,
    }),
  );

  if (!getResult.Body) {
    throw new Error(`Source object body is empty or not found: ${args.sourceBucket}/${args.sourceKey}`);
  }

  const putResult = await args.targetClient.send(
    new PutObjectCommand({
      Bucket: args.targetBucket,
      Key: args.targetKey,
      Body: getResult.Body as PutObjectCommandInput["Body"],
      ContentLength: getResult.ContentLength,
      ContentType: args.contentType || getResult.ContentType,
    }),
  );

  return {
    sizeBytes: getResult.ContentLength ?? 0,
    eTag: putResult.ETag,
  };
}
