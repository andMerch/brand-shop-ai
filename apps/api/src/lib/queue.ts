import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null
});

export const aiVisionQueue = new Queue("ai-vision", { connection });
export const analyticsQueue = new Queue("analytics", { connection });
