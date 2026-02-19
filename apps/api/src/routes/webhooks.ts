import { FastifyInstance } from "fastify";
import { prisma, Prisma } from "../lib/db.js";
import { aiVisionQueue } from "../lib/queue.js";
import { config } from "../lib/config.js";

export async function webhooksRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/ghl", async (request, reply) => {
    const headerSecret =
      (request.headers["x-ghl-webhook-secret"] as string | undefined) ||
      (request.headers["x-webhook-secret"] as string | undefined) ||
      (request.headers["x-ghl-secret"] as string | undefined);
    const querySecret = (request.query as { secret?: string; webhook_secret?: string } | undefined)?.secret ??
      (request.query as { secret?: string; webhook_secret?: string } | undefined)?.webhook_secret;
    const providedSecret = headerSecret ?? querySecret;
    if (config.ghlWebhookSecret && providedSecret !== config.ghlWebhookSecret) {
      return reply.status(401).send({ ok: false, error: "invalid_webhook_secret" });
    }

    const payload = request.body as Record<string, unknown> | undefined;
    const eventType =
      (payload?.type as string | undefined) ||
      (payload?.eventType as string | undefined) ||
      (request.headers["x-ghl-event"] as string | undefined) ||
      "unknown";

    const locationId =
      (payload?.locationId as string | undefined) ||
      (payload?.location_id as string | undefined) ||
      (payload?.location as string | undefined);

    let tenantId: string | undefined;
    if (locationId) {
      const location = await prisma.ghlLocation.findFirst({ where: { locationId } });
      tenantId = location?.tenantId ?? undefined;
    }

    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        tenantId,
        locationId,
        eventType,
        payload: (payload ?? {}) as Prisma.InputJsonValue
      }
    });

    const attachments = (payload?.attachments as Array<{ url?: string }> | undefined) ?? [];
    const conversation = payload?.conversation as { id?: string } | undefined;
    const conversationId =
      (payload?.conversationId as string | undefined) ||
      (payload?.conversation_id as string | undefined) ||
      conversation?.id;
    if (attachments.length > 0 && tenantId) {
      for (const attachment of attachments) {
        if (!attachment.url) continue;
        await aiVisionQueue.add("ai-vision", {
          tenantId,
          locationId,
          source: "GHL_ATTACHMENT",
          sourceRef: conversationId ?? webhookEvent.id,
          inputUrl: attachment.url
        });
      }
    }

    return reply.send({ ok: true });
  });
}
