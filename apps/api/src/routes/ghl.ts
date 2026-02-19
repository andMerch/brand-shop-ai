import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";

export async function ghlRoutes(app: FastifyInstance) {
  app.post("/api/ghl/connect", async (request, reply) => {
    const body = request.body as {
      tenantName?: string;
      tenantId?: string;
      locationId?: string;
      apiKey?: string;
    };

    if (!body.locationId) {
      return reply.status(400).send({ ok: false, error: "locationId_required" });
    }

    let tenantId = body.tenantId;
    if (!tenantId) {
      if (!body.tenantName) {
        return reply.status(400).send({ ok: false, error: "tenantName_required" });
      }
      const tenant = await prisma.tenant.create({
        data: {
          name: body.tenantName
        }
      });
      tenantId = tenant.id;
    }

    const location = await prisma.ghlLocation.upsert({
      where: { locationId: body.locationId },
      update: {
        apiKey: body.apiKey ?? undefined,
        tenantId
      },
      create: {
        locationId: body.locationId,
        apiKey: body.apiKey ?? null,
        tenantId
      }
    });

    return reply.send({ ok: true, tenantId, locationId: location.locationId });
  });
}
