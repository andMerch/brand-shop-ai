import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { Prisma } from "@prisma/client";
import { SupplierAccountSchema } from "@app/shared";

function normalizeCredentials(input: Record<string, unknown>): Prisma.InputJsonValue {
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      trimmed[key] = value.trim();
    } else {
      trimmed[key] = value;
    }
  }
  return trimmed as Prisma.InputJsonValue;
}

export async function supplierAccountsRoutes(app: FastifyInstance) {
  app.get("/api/supplier-accounts", async (request, reply) => {
    const query = request.query as { tenantId?: string } | undefined;
    const tenantId = query?.tenantId;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, error: "tenant_id_required" });
    }

    const accounts = await prisma.supplierAccount.findMany({
      where: { tenantId }
    });

    return reply.send({
      ok: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        tenantId: account.tenantId,
        supplier: account.supplier,
        baseUrl: account.baseUrl,
        active: account.active,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }))
    });
  });

  app.post("/api/supplier-accounts", async (request, reply) => {
    const parse = SupplierAccountSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { tenantId, supplier, credentials, baseUrl, active } = parse.data;
    const normalizedCredentials = normalizeCredentials(credentials);

    if (supplier === "SSACTIVEWEAR") {
      const accountNumber = normalizedCredentials.accountNumber as string | undefined;
      const apiKey = normalizedCredentials.apiKey as string | undefined;
      if (!accountNumber || !apiKey) {
        return reply.status(400).send({
          ok: false,
          error: "ssactivewear_credentials_required"
        });
      }
    }

    const existing = await prisma.supplierAccount.findFirst({
      where: { tenantId, supplier }
    });

    const record = existing
      ? await prisma.supplierAccount.update({
          where: { id: existing.id },
          data: {
            credentials: normalizedCredentials,
            baseUrl,
            active: active ?? true
          }
        })
      : await prisma.supplierAccount.create({
          data: {
            tenantId,
            supplier,
            credentials: normalizedCredentials,
            baseUrl,
            active: active ?? true
          }
        });

    return reply.send({ ok: true, supplierAccountId: record.id });
  });
}
