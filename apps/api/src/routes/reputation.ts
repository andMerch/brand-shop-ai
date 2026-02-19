import { FastifyInstance } from "fastify";
import { ReputationRequestSchema } from "@app/shared";
import { getGhlClientForLocation } from "../lib/ghlClient.js";

export async function reputationRoutes(app: FastifyInstance) {
  app.post("/api/reputation/request", async (request, reply) => {
    const parse = ReputationRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const ghl = await getGhlClientForLocation(parse.data.locationId);
    await ghl.triggerReviewRequest(parse.data.locationId, parse.data.contactId, parse.data.channel);

    return reply.send({ ok: true });
  });
}
