import sharp from "sharp";
import { prisma } from "../lib/db.js";
import { storeFile } from "../lib/storage.js";

export type DecorationType = "PUFF" | "DTG" | "NONE";

export type MockupLayerInput = {
  logoUrl?: string;
  placement: string;
  x?: number;
  y?: number;
  widthRatio?: number;
  decoration?: DecorationType;
};

const placementPresets: Record<string, { x: number; y: number; widthRatio: number }> = {
  LEFT_CHEST: { x: 0.32, y: 0.33, widthRatio: 0.18 },
  RIGHT_CHEST: { x: 0.68, y: 0.33, widthRatio: 0.18 },
  FULL_FRONT: { x: 0.5, y: 0.45, widthRatio: 0.55 },
  FULL_BACK: { x: 0.5, y: 0.45, widthRatio: 0.55 },
  BACK: { x: 0.5, y: 0.5, widthRatio: 0.45 },
  HAT_FRONT: { x: 0.5, y: 0.48, widthRatio: 0.32 },
  HAT_LEFT: { x: 0.33, y: 0.48, widthRatio: 0.26 },
  HAT_RIGHT: { x: 0.67, y: 0.48, widthRatio: 0.26 },
  HAT_BACK: { x: 0.5, y: 0.52, widthRatio: 0.24 },
  HAT_SIDE: { x: 0.78, y: 0.5, widthRatio: 0.22 }
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

function resolveLayerPlacement(layer: MockupLayerInput) {
  const preset = placementPresets[layer.placement] ?? placementPresets.FULL_FRONT;
  return {
    x: typeof layer.x === "number" ? layer.x : preset.x,
    y: typeof layer.y === "number" ? layer.y : preset.y,
    widthRatio: typeof layer.widthRatio === "number" ? layer.widthRatio : preset.widthRatio
  };
}

async function applyDecoration(logo: Buffer, decoration: DecorationType) {
  if (decoration === "DTG") {
    return await sharp(logo)
      .modulate({ brightness: 0.98, saturation: 0.9 })
      .blur(0.35)
      .png()
      .toBuffer();
  }

  if (decoration === "PUFF") {
    const meta = await sharp(logo).metadata();
    const width = meta.width ?? 512;
    const height = meta.height ?? 512;

    const shadow = await sharp(logo)
      .blur(8)
      .modulate({ brightness: 0.6 })
      .png()
      .toBuffer();

    const highlight = await sharp(logo)
      .blur(2)
      .modulate({ brightness: 1.25 })
      .png()
      .toBuffer();

    const canvas = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    return await canvas
      .composite([
        { input: shadow, left: 0, top: 2 },
        { input: logo, left: 0, top: 0 },
        { input: highlight, left: 0, top: -1 }
      ])
      .png()
      .toBuffer();
  }

  return await sharp(logo).png().toBuffer();
}

async function renderMockup(baseImage: Buffer, layers: MockupLayerInput[]) {
  const base = sharp(baseImage);
  const metadata = await base.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 1200;

  const composites = [] as Array<{ input: Buffer; left: number; top: number }>;

  for (const layer of layers) {
    if (!layer.logoUrl) continue;
    const logoBuffer = await fetchBuffer(layer.logoUrl);
    const decorated = await applyDecoration(logoBuffer, layer.decoration ?? "NONE");
    const placement = resolveLayerPlacement(layer);
    const logoWidth = Math.max(48, Math.round(width * placement.widthRatio));

    const resized = await sharp(decorated)
      .resize({ width: logoWidth, height: logoWidth, fit: "inside" })
      .png()
      .toBuffer();

    const logoMeta = await sharp(resized).metadata();
    const logoW = logoMeta.width ?? logoWidth;
    const logoH = logoMeta.height ?? logoWidth;

    const left = Math.max(0, Math.round(width * placement.x - logoW / 2));
    const top = Math.max(0, Math.round(height * placement.y - logoH / 2));

    composites.push({ input: resized, left, top });
  }

  return await base.composite(composites).png().toBuffer();
}

export async function generateMockupsForProduct(params: {
  storeId: string;
  productId: string;
  variantIds?: string[] | null;
  layers: MockupLayerInput[];
  overwrite?: boolean;
}) {
  const { storeId, productId, variantIds, layers, overwrite } = params;

  const store = await prisma.store.findFirst({ where: { id: storeId } });
  if (!store) {
    throw new Error("store_not_found");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId },
    include: { variants: true }
  });
  if (!product) {
    throw new Error("product_not_found");
  }

  const targetVariants = variantIds?.length
    ? product.variants.filter((variant) => variantIds.includes(variant.id))
    : product.variants;

  const results: Array<{ variantId: string | null; imageUrl: string; placement: string }> = [];
  const variantsToProcess = targetVariants.length ? targetVariants : [null];

  const grouped = layers.reduce((acc, layer) => {
    const placement = layer.placement ?? "FULL_FRONT";
    const list = acc.get(placement) ?? [];
    list.push(layer);
    acc.set(placement, list);
    return acc;
  }, new Map<string, MockupLayerInput[]>());

  for (const variant of variantsToProcess) {
    const baseImageUrl = variant?.imageUrl ?? product.imageUrl;
    if (!baseImageUrl) continue;

    const baseBuffer = await fetchBuffer(baseImageUrl);

    for (const [placement, placementLayers] of grouped.entries()) {
      const exists = await prisma.productMockup.findFirst({
        where: {
          storeId,
          productId,
          variantId: variant?.id ?? null,
          placement
        }
      });

      if (exists && !overwrite) {
        results.push({ variantId: variant?.id ?? null, imageUrl: exists.imageUrl, placement });
        continue;
      }

      const mockupBuffer = await renderMockup(baseBuffer, placementLayers);

      const stored = await storeFile({
        filename: `mockup-${placement}-${variant?.id ?? "product"}.png`,
        data: mockupBuffer,
        contentType: "image/png"
      });

      if (exists) {
        await prisma.productMockup.update({
          where: { id: exists.id },
          data: { imageUrl: stored.url, metadata: { layers: placementLayers } }
        });
      } else {
        await prisma.productMockup.create({
          data: {
            storeId,
            productId,
            variantId: variant?.id ?? null,
            placement,
            imageUrl: stored.url,
            metadata: { layers: placementLayers }
          }
        });
      }

      results.push({ variantId: variant?.id ?? null, imageUrl: stored.url, placement });
    }
  }

  return results;
}
