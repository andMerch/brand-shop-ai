import { Queue } from "bullmq";
import { config } from "./config.js";

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
  tls: redisUrl.protocol === "rediss:" ? {} : undefined
};

export const aiVisionQueue = new Queue("ai-vision", { connection });
export const analyticsQueue = new Queue("analytics", { connection });
