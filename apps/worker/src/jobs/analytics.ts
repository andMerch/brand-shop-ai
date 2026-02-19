import { prisma } from "@app/db";
import { computeDashboardSummary } from "./summary.js";

export async function processAnalyticsJob(data: { tenantId: string }) {
  const summary = await computeDashboardSummary(data.tenantId);

  const entries = Object.entries(summary);
  for (const [key, value] of entries) {
    await prisma.dashboardMetric.create({
      data: {
        tenantId: data.tenantId,
        key,
        value: Number(value)
      }
    });
  }

  return summary;
}
