/**
 * AWS configuration. Uses env vars when set; otherwise mock mode.
 */
export const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
export const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE ?? "";
export const S3_BUCKET = process.env.S3_BUCKET ?? "";
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0";

export const isAwsConfigured = () => Boolean(DYNAMODB_TABLE && S3_BUCKET);
