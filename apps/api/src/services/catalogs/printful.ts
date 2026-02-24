import { prisma } from "../../lib/db.js";
import { config } from "../../lib/config.js";

type PrintfulProduct = {
  id: number;
  name: string;
};

type PrintfulVariant = {
  id?: number;
  external_id?: string;
  sku?: string;
  name?: string;
  size?: string;
  color?: string;
  color_code?: string;
  image?: string;
  image_url?: string;
  files?: Array<{ preview_url?: string }>;
  price?: string | number;
  retail_price?: string | number;
};

export async function syncPrintfulCatalog(input: {
  tenantId: string;
  storeId?: string;
  limit?: number;
}) {
  if (!config.printful.apiKey) {
    throw new Error("printful_api_key_missing");
  }

  const listUrl = new URL(`${config.printful.baseUrl}/store/products`);
  if (input.limit) {
    listUrl.searchParams.set("limit", String(input.limit));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.printful.apiKey}`,
    "Content-Type": "application/json"
  };
  if (config.printful.storeId) {
    headers["X-PF-Store-Id"] = config.printful.storeId;
  }

  const listResponse = await fetch(listUrl.toString(), { headers });
  if (!listResponse.ok) {
    const body = await listResponse.text();
    throw new Error(`printful_request_failed:${listResponse.status}:${body}`);
  }

  const listData = (await listResponse.json()) as {
    result?: PrintfulProduct[];
  };
  const products = listData.result ?? [];

  const existingSupplier = await prisma.supplier.findFirst({
    where: { tenantId: input.tenantId, name: "Printful" }
  });
  const supplier = existingSupplier
    ? existingSupplier
    : await prisma.supplier.create({
        data: {
          tenantId: input.tenantId,
          name: "Printful",
          metadata: {}
        }
      });

  let catalogId: string | null = null;
  if (input.storeId) {
    const catalog = await prisma.catalog.findFirst({
      where: { storeId: input.storeId }
    });
    if (catalog) {
      catalogId = catalog.id;
    } else {
      const created = await prisma.catalog.create({
        data: {
          tenantId: input.tenantId,
          storeId: input.storeId,
          name: "Printful Catalog"
        }
      });
      catalogId = created.id;
    }
  }

  const synced: string[] = [];
  for (const item of products) {
    const detailsUrl = `${config.printful.baseUrl}/store/products/${item.id}`;
    const detailsResponse = await fetch(detailsUrl, { headers });
    if (!detailsResponse.ok) {
      continue;
    }

    const detailsData = (await detailsResponse.json()) as {
      result?: {
        sync_product?: {
          name?: string;
          thumbnail_url?: string;
          image?: string;
          description?: string;
          brand?: string;
          type_name?: string;
        };
        sync_variants?: PrintfulVariant[];
      };
    };

    const variant = detailsData.result?.sync_variants?.[0];
    const rawCost = variant?.price ?? variant?.retail_price ?? 0;
    const baseCost =
      typeof rawCost === "string" ? Number.parseFloat(rawCost) : Number(rawCost ?? 0);

    const productName = detailsData.result?.sync_product?.name ?? item.name;
    const productImage =
      detailsData.result?.sync_product?.thumbnail_url ??
      detailsData.result?.sync_product?.image ??
      variant?.image ??
      variant?.image_url ??
      variant?.files?.[0]?.preview_url ??
      undefined;
    const productDescription = detailsData.result?.sync_product?.description;
    const productBrand = detailsData.result?.sync_product?.brand;
    const productCategory = detailsData.result?.sync_product?.type_name;
    const productType = productCategory;

    const existing = await prisma.product.findFirst({
      where: {
        tenantId: input.tenantId,
        supplierId: supplier.id,
        externalId: String(item.id)
      }
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: productName,
            brand: productBrand,
            description: productDescription,
            category: productCategory,
            productType,
            imageUrl: productImage,
            price: Number.isNaN(baseCost) ? 0 : baseCost,
            source: "PRINTFUL",
            metadata: detailsData.result as unknown as Record<string, unknown> as any
          }
        })
      : await prisma.product.create({
          data: {
            tenantId: input.tenantId,
            supplierId: supplier.id,
            name: productName,
            brand: productBrand,
            description: productDescription,
            category: productCategory,
            productType,
            imageUrl: productImage,
            price: Number.isNaN(baseCost) ? 0 : baseCost,
            source: "PRINTFUL",
            externalId: String(item.id),
            metadata: detailsData.result as unknown as Record<string, unknown> as any
          }
        });

    const variants = detailsData.result?.sync_variants ?? [];
    for (const v of variants) {
      const rawVariantCost = v.price ?? v.retail_price ?? 0;
      const variantCost =
        typeof rawVariantCost === "string"
          ? Number.parseFloat(rawVariantCost)
          : Number(rawVariantCost ?? 0);
      const variantExternal = v.external_id ?? String(v.id ?? "");
      if (!variantExternal) continue;

      const variantImage =
        v.image ??
        v.image_url ??
        v.files?.[0]?.preview_url ??
        productImage ??
        undefined;

      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, externalId: variantExternal }
      });

      if (existingVariant) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            sku: v.sku,
            size: v.size,
            color: v.color,
            imageUrl: variantImage,
            baseCost: Number.isNaN(variantCost) ? 0 : variantCost,
            metadata: v as unknown as Record<string, unknown> as any
          }
        });
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            externalId: variantExternal,
            sku: v.sku,
            size: v.size,
            color: v.color,
            imageUrl: variantImage,
            baseCost: Number.isNaN(variantCost) ? 0 : variantCost,
            metadata: v as unknown as Record<string, unknown> as any
          }
        });
      }
    }

    if (catalogId) {
      const exists = await prisma.catalogItem.findFirst({
        where: { catalogId, productId: product.id }
      });
      if (!exists) {
        await prisma.catalogItem.create({
          data: { catalogId, productId: product.id }
        });
      }
    }

    synced.push(product.id);
  }

  return { synced, count: synced.length };
}
