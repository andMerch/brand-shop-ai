export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3001",
  brandBaseDomain: process.env.BRAND_BASE_DOMAIN ?? "brand-shop.ai",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  ghlBaseUrl: process.env.GHL_BASE_URL ?? "https://services.leadconnectorhq.com",
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  ghlWebhookSecret: process.env.GHL_WEBHOOK_SECRET ?? "",
  ssactivewear: {
    baseUrl: process.env.SSACTIVEWEAR_BASE_URL ?? "https://api.ssactivewear.com/v2",
    accountNumber: process.env.SSACTIVEWEAR_ACCOUNT_NUMBER ?? "",
    apiKey: process.env.SSACTIVEWEAR_API_KEY ?? ""
  },
  printful: {
    baseUrl: process.env.PRINTFUL_BASE_URL ?? "https://api.printful.com",
    apiKey: process.env.PRINTFUL_API_KEY ?? "",
    storeId: process.env.PRINTFUL_STORE_ID ?? ""
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ""
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "ai-vision"
  },
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini"
};
