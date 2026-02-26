import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { MockupGenerateSchema, MockupSettingsSchema } from "@app/shared";
import { storeFile } from "../lib/storage.js";
import { MockupPlacement } from "@prisma/client";
import { generateMockupsForProduct, MockupLayerInput } from "../services/mockups.js";

export async function mockupRoutes(app: FastifyInstance) {
  app.post("/api/storefront/logo", async (request, reply) => {
    const storeId = (request.query as { storeId?: string } | undefined)?.storeId;
    if (!storeId) {
      return reply.status(400).send({ ok: false, error: "store_id_required" });
    }

    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ ok: false, error: "file_required" });
    }

    const buffer = await file.toBuffer();
    const stored = await storeFile({
      filename: file.filename ?? "logo.png",
      data: buffer,
      contentType: file.mimetype
    });

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const brand = (config.brand as Record<string, unknown> | null) ?? {};
    await prisma.store.update({
      where: { id: store.id },
      data: {
        config: {
          ...config,
          brand: {
            ...brand,
            logoUrl: stored.url
          }
        }
      }
    });

    return reply.send({ ok: true, logoUrl: stored.url });
  });

  app.post("/api/storefront/mockups/generate", async (request, reply) => {
    const parse = MockupGenerateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const {
      storeId,
      productId,
      variantId,
      placement,
      logoUrl,
      overwrite,
      decoration,
      layers
    } = parse.data;

    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const brand = (config.brand as Record<string, unknown> | null) ?? {};
    const resolvedLogoUrl = logoUrl ?? (brand.logoUrl as string | undefined);

    const normalizedLayers: MockupLayerInput[] = (layers ?? []).map((layer) => ({
      ...layer,
      placement: layer.placement as MockupPlacement,
      logoUrl: layer.logoUrl ?? resolvedLogoUrl,
      decoration: (layer.decoration as any) ?? decoration ?? "NONE"
    }));

    if (!normalizedLayers.length) {
      if (!resolvedLogoUrl) {
        return reply.status(400).send({ ok: false, error: "logo_required" });
      }
      normalizedLayers.push({
        logoUrl: resolvedLogoUrl,
        placement: placement as MockupPlacement,
        decoration: decoration ?? "NONE"
      });
    }

    const results = await generateMockupsForProduct({
      storeId,
      productId,
      variantIds: variantId ? [variantId] : null,
      layers: normalizedLayers,
      overwrite
    });

    return reply.send({ ok: true, placement, results });
  });

  app.post("/api/storefront/mockups/settings", async (request, reply) => {
    const parse = MockupSettingsSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { storeId, ...settings } = parse.data;
    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const mockups = (config.mockups as Record<string, unknown> | null) ?? {};

    await prisma.store.update({
      where: { id: store.id },
      data: {
        config: {
          ...config,
          mockups: {
            ...mockups,
            ...settings
          }
        }
      }
    });

    return reply.send({ ok: true });
  });
}
