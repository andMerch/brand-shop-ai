export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  ghlBaseUrl: process.env.GHL_BASE_URL ?? "https://services.leadconnectorhq.com",
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini"
};
