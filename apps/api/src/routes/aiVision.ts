import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { aiVisionQueue } from "../lib/queue.js";
import { storeFile } from "../lib/storage.js";
import { AiVisionIngestSchema } from "@app/shared";
import { resolveTenantId } from "../lib/tenant.js";

export async function aiVisionRoutes(app: FastifyInstance) {
  app.post("/api/ai-vision/ingest", async (request, reply) => {
    const file = await request.file();
    const metaRaw = request.body as Record<string, unknown> | undefined;
    const parsed = AiVisionIngestSchema.safeParse(metaRaw);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    if (!file) {
      return reply.status(400).send({ ok: false, error: "file_required" });
    }

    const buffer = await file.toBuffer();
    const stored = await storeFile({
      filename: file.filename,
      data: buffer,
      contentType: file.mimetype
    });

    let resolvedTenantId: string;
    try {
      resolvedTenantId = await resolveTenantId({
        tenantId: parsed.data.tenantId,
        locationId: parsed.data.locationId
      });
    } catch {
      return reply.status(400).send({ ok: false, error: "location_not_linked" });
    }

    const job = await prisma.aiVisionJob.create({
      data: {
        tenantId: resolvedTenantId,
        source: parsed.data.source === "ghl" ? "GHL_ATTACHMENT" : "UPLOAD",
        sourceRef: parsed.data.sourceRef,
        inputUrl: stored.url,
        status: "QUEUED"
      }
    });

    await aiVisionQueue.add("ai-vision", {
      jobId: job.id,
      tenantId: resolvedTenantId,
      locationId: parsed.data.locationId,
      source: job.source,
      sourceRef: job.sourceRef,
      inputUrl: job.inputUrl
    });

    return reply.send({ ok: true, jobId: job.id });
  });

  app.post("/api/ai-vision/from-ghl", async (request, reply) => {
    const body = request.body as {
      tenantId?: string;
      locationId?: string;
      conversationId?: string;
      attachmentUrls?: string[];
    };

    if (!body.attachmentUrls?.length) {
      return reply.status(400).send({ ok: false, error: "missing_fields" });
    }

    let resolvedTenantId: string;
    try {
      resolvedTenantId = await resolveTenantId({
        tenantId: body.tenantId,
        locationId: body.locationId
      });
    } catch {
      return reply.status(400).send({ ok: false, error: "location_not_linked" });
    }

    const created: string[] = [];
    for (const url of body.attachmentUrls) {
      const job = await prisma.aiVisionJob.create({
        data: {
          tenantId: resolvedTenantId,
          source: "GHL_ATTACHMENT",
          sourceRef: body.conversationId,
          inputUrl: url,
          status: "QUEUED"
        }
      });
      await aiVisionQueue.add("ai-vision", {
        jobId: job.id,
        tenantId: resolvedTenantId,
        locationId: body.locationId,
        source: job.source,
        sourceRef: body.conversationId,
        inputUrl: url
      });
      created.push(job.id);
    }

    return reply.send({ ok: true, jobIds: created });
  });
}
