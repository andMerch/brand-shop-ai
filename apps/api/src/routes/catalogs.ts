import { FastifyInstance } from "fastify";
import { CatalogSyncSchema } from "@app/shared";
import { prisma } from "../lib/db.js";
import { syncSsActivewearCatalog } from "../services/catalogs/ssactivewear.js";
import { syncPrintfulCatalog } from "../services/catalogs/printful.js";
import { syncSanmarCatalog } from "../services/catalogs/sanmar.js";
import { generateMockupsForProduct, MockupLayerInput } from "../services/mockups.js";

async function autoGenerateMockups(params: {
  storeId: string;
  productIds: string[];
}) {
  const store = await prisma.store.findFirst({ where: { id: params.storeId } });
  if (!store) return;

  const config = (store.config as Record<string, unknown> | null) ?? {};
  const mockups = (config.mockups as Record<string, unknown> | null) ?? {};
  const autoGenerate = Boolean(mockups.autoGenerate);
  if (!autoGenerate) return;

  const brand = (config.brand as Record<string, unknown> | null) ?? {};
  const logoUrl = (mockups.logoUrl as string | undefined) ?? (brand.logoUrl as string | undefined);
  if (!logoUrl) return;

  const placements = (mockups.autoPlacements as string[] | undefined) ?? ["FULL_FRONT"];
  const decoration = (mockups.decoration as string | undefined) ?? "NONE";
  const autoColors = new Set((mockups.autoColors as string[] | undefined) ?? []);
  const autoSizes = new Set((mockups.autoSizes as string[] | undefined) ?? []);

  const products = await prisma.product.findMany({
    where: { id: { in: params.productIds } },
    include: { variants: true }
  });

  for (const product of products) {
    const variantIds = product.variants
      .filter((variant) => {
        if (autoColors.size && variant.color && !autoColors.has(variant.color)) return false;
        if (autoSizes.size && variant.size && !autoSizes.has(variant.size)) return false;
        return true;
      })
      .map((variant) => variant.id);

    for (const placement of placements) {
      const layers: MockupLayerInput[] = [
        {
          logoUrl,
          placement,
          decoration: decoration as any
        }
      ];
      await generateMockupsForProduct({
        storeId: params.storeId,
        productId: product.id,
        variantIds: variantIds.length ? variantIds : null,
        layers,
        overwrite: false
      });
    }
  }
}

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
      if (storeId && result?.synced?.length) {
        await autoGenerateMockups({ storeId, productIds: result.synced });
      }
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
    if (storeId && result?.synced?.length) {
      await autoGenerateMockups({ storeId, productIds: result.synced });
    }
    return reply.send({ ok: true, source, result });
  });
}
