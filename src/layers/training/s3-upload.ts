import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';

let s3Instance: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Instance) {
    if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured');
    }
    s3Instance = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
      // STORAGE_ENDPOINT enables MinIO for local dev or custom S3-compatible stores
      ...(config.STORAGE_ENDPOINT ? { endpoint: config.STORAGE_ENDPOINT, forcePathStyle: true } : {}),
    });
  }
  return s3Instance;
}

export async function uploadRecording(
  callId: string,
  audioUrl: string
): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.status}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const s3Key = `recordings/${callId}.mp3`;

  const s3 = getS3();
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    })
  );

  logger.info('s3', `Uploaded recording: ${s3Key}`, { callId });
  return s3Key;
}
