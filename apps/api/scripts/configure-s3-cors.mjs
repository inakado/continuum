import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const origin = process.env.WEB_ORIGIN;
const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;

if (!origin || !endpoint || !bucket || new URL(origin).origin !== origin) {
  throw new Error('WEB_ORIGIN, S3_ENDPOINT и S3_BUCKET должны быть заданы корректно.');
}
if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
  throw new Error('Для production CORS требуется HTTPS origin.');
}
if (process.env.NODE_ENV !== 'production') {
  console.log('Локальное хранилище: CORS управляется MinIO.');
  process.exit(0);
}

const client = new S3Client({
  endpoint,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

let rules;
try {
  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  rules = current.CORSRules || [];
} catch (error) {
  if (error?.name === 'NoSuchCORSConfiguration') {
    rules = [];
  } else {
    throw error;
  }
}

const alreadyAllowed = rules.some((rule) =>
  rule.AllowedOrigins?.includes(origin) &&
  rule.AllowedMethods?.includes('PUT') &&
  rule.AllowedHeaders?.some((header) => header === '*' || header.toLowerCase() === 'content-type'),
);

if (!alreadyAllowed) {
  await client.send(new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [...rules, {
        AllowedOrigins: [origin],
        AllowedMethods: ['PUT'],
        AllowedHeaders: ['Content-Type'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 300,
      }],
    },
  }));
}

const confirmed = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
if (!confirmed.CORSRules?.some((rule) =>
  rule.AllowedOrigins?.includes(origin) && rule.AllowedMethods?.includes('PUT'),
)) {
  throw new Error('Не удалось подтвердить CORS для загрузки PDF.');
}
console.log(`S3 CORS для ${origin}: PUT разрешён.`);
