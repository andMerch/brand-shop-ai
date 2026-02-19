import { Worker } from "bullmq";
import { config } from "./lib/config.js";
import { processAiVisionJob } from "./jobs/aiVision.js";
import { processAnalyticsJob } from "./jobs/analytics.js";

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
  tls: redisUrl.protocol === "rediss:" ? {} : undefined
};

const aiVisionWorker = new Worker(
  "ai-vision",
  async (job) => {
    await processAiVisionJob(job.data);
  },
  { connection }
);

const analyticsWorker = new Worker(
  "analytics",
  async (job) => {
    await processAnalyticsJob(job.data);
  },
  { connection }
);

aiVisionWorker.on("failed", (job, err) => {
  console.error("AI Vision job failed", job?.id, err);
});

analyticsWorker.on("failed", (job, err) => {
  console.error("Analytics job failed", job?.id, err);
});

console.log("Workers started");
