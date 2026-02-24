import { FastifyInstance } from "fastify";
import { CatalogSyncSchema } from "@app/shared";
import { prisma } from "../lib/db.js";
import { syncSsActivewearCatalog } from "../services/catalogs/ssactivewear.js";
import { syncPrintfulCatalog } from "../services/catalogs/printful.js";
import { syncSanmarCatalog } from "../services/catalogs/sanmar.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.post("/api/catalogs/sync", async (request, reply) => {
    const parse = CatalogSyncSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { tenantId, storeId, source, limit, supplierAccountId } = parse.data;

    let supplierAccount: { supplier: string; credentials: any; baseUrl?: string | null } | null = null;
    if (supplierAccountId) {
      supplierAccount = await prisma.supplierAccount.findFirst({
        where: { id: supplierAccountId, tenantId }
      });
      if (!supplierAccount) {
        return reply.status(404).send({ ok: false, error: "supplier_account_not_found" });
      }
    }

    if (source === "ssactivewear") {
      if (supplierAccount && supplierAccount.supplier !== "SSACTIVEWEAR") {
        return reply.status(400).send({ ok: false, error: "supplier_account_mismatch" });
      }
      const creds = supplierAccount?.credentials ?? {};
      const account =
        supplierAccount && creds
          ? {
              accountNumber: String(creds.accountNumber ?? "").trim(),
              apiKey: String(creds.apiKey ?? "").trim(),
              baseUrl: supplierAccount.baseUrl ?? undefined
            }
          : undefined;
      const result = await syncSsActivewearCatalog({ tenantId, storeId, limit, account });
      return reply.send({ ok: true, source, result });
    }

    if (source === "sanmar") {
      if (supplierAccount && supplierAccount.supplier !== "SANMAR") {
        return reply.status(400).send({ ok: false, error: "supplier_account_mismatch" });
      }
      try {
        const result = await syncSanmarCatalog();
        return reply.send({ ok: true, source, result });
      } catch (error) {
        if ((error as Error).message === "sanmar_not_implemented") {
          return reply.status(501).send({ ok: false, error: "sanmar_not_implemented" });
        }
        throw error;
      }
    }

    const result = await syncPrintfulCatalog({ tenantId, storeId, limit });
    return reply.send({ ok: true, source, result });
  });
}
