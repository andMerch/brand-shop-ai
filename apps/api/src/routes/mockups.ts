import { FastifyInstance } from "fastify";
import sharp from "sharp";
import { prisma } from "../lib/db.js";
import { MockupGenerateSchema } from "@app/shared";
import { storeFile } from "../lib/storage.js";

const placementPresets: Record<
  string,
  { x: number; y: number; widthRatio: number }
> = {
  LEFT_CHEST: { x: 0.32, y: 0.33, widthRatio: 0.18 },
  RIGHT_CHEST: { x: 0.68, y: 0.33, widthRatio: 0.18 },
  FULL_FRONT: { x: 0.5, y: 0.45, widthRatio: 0.55 },
  FULL_BACK: { x: 0.5, y: 0.45, widthRatio: 0.55 },
  BACK: { x: 0.5, y: 0.5, widthRatio: 0.45 }
};

async function fetchBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`image_fetch_failed:${response.status}:${body}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateMockup({
  baseImage,
  logo,
  placement
}: {
  baseImage: Buffer;
  logo: Buffer;
  placement: keyof typeof placementPresets;
}) {
  const preset = placementPresets[placement] ?? placementPresets.FULL_FRONT;
  const base = sharp(baseImage);
  const metadata = await base.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 1200;
  const logoWidth = Math.max(64, Math.round(width * preset.widthRatio));

  const logoBuffer = await sharp(logo)
    .resize({ width: logoWidth, height: logoWidth, fit: "inside" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoW = logoMeta.width ?? logoWidth;
  const logoH = logoMeta.height ?? logoWidth;

  const left = Math.max(0, Math.round(width * preset.x - logoW / 2));
  const top = Math.max(0, Math.round(height * preset.y - logoH / 2));

  return await base
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

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

    const { storeId, productId, variantId, placement, logoUrl, overwrite } = parse.data;

    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId },
      include: { variants: true }
    });
    if (!product) {
      return reply.status(404).send({ ok: false, error: "product_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const brand = (config.brand as Record<string, unknown> | null) ?? {};
    const resolvedLogoUrl = logoUrl ?? (brand.logoUrl as string | undefined);
    if (!resolvedLogoUrl) {
      return reply.status(400).send({ ok: false, error: "logo_required" });
    }

    const logoBuffer = await fetchBuffer(resolvedLogoUrl);
    const targetVariants = variantId
      ? product.variants.filter((variant) => variant.id === variantId)
      : product.variants;

    if (variantId && targetVariants.length === 0) {
      return reply.status(404).send({ ok: false, error: "variant_not_found" });
    }

    const results: Array<{ variantId: string | null; imageUrl: string }> = [];

    const variantsToProcess = targetVariants.length ? targetVariants : [null];
    for (const variant of variantsToProcess) {
      const baseImageUrl = variant?.imageUrl ?? product.imageUrl;
      if (!baseImageUrl) continue;

      const exists = await prisma.productMockup.findFirst({
        where: {
          storeId,
          productId,
          variantId: variant?.id ?? null,
          placement
        }
      });
      if (exists && !overwrite) {
        results.push({ variantId: variant?.id ?? null, imageUrl: exists.imageUrl });
        continue;
      }

      const baseBuffer = await fetchBuffer(baseImageUrl);
      const mockupBuffer = await generateMockup({
        baseImage: baseBuffer,
        logo: logoBuffer,
        placement
      });

      const stored = await storeFile({
        filename: `mockup-${placement}-${variant?.id ?? "product"}.png`,
        data: mockupBuffer,
        contentType: "image/png"
      });

      if (exists) {
        await prisma.productMockup.update({
          where: { id: exists.id },
          data: { imageUrl: stored.url }
        });
      } else {
        await prisma.productMockup.create({
          data: {
            storeId,
            productId,
            variantId: variant?.id ?? null,
            placement,
            imageUrl: stored.url
          }
        });
      }

      results.push({ variantId: variant?.id ?? null, imageUrl: stored.url });
    }

    return reply.send({ ok: true, placement, results });
  });
}
