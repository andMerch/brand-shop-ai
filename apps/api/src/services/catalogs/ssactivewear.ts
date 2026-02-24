import { prisma } from "../../lib/db.js";
import { config } from "../../lib/config.js";

type SsProduct = {
  productId?: string;
  styleID?: string;
  styleId?: string;
  title?: string;
  name?: string;
  styleName?: string;
  brandName?: string;
  description?: string;
  styleDescription?: string;
  category?: string;
  categoryName?: string;
  subCategory?: string;
  subCategoryName?: string;
  colorName?: string;
  color?: string;
  sizeName?: string;
  size?: string;
  sku?: string;
  image?: string;
  imageURL?: string;
  imageUrl?: string;
  mainImage?: string;
  casePrice?: number;
  customerPrice?: number;
  piecePrice?: number;
};

type SsAccount = {
  accountNumber: string;
  apiKey: string;
  baseUrl?: string;
};

function resolveProductName(item: SsProduct) {
  return item.title || item.name || item.styleName || "SSActivewear Product";
}

function resolveExternalId(item: SsProduct) {
  return item.productId || item.styleID || item.styleId;
}

function resolveStyleKey(item: SsProduct) {
  return item.styleID || item.styleId || item.productId;
}

function resolveVariantImage(item: SsProduct) {
  return item.image || item.imageURL || item.imageUrl || item.mainImage;
}

function resolveCategory(item: SsProduct) {
  return (
    item.categoryName ||
    item.category ||
    item.subCategoryName ||
    item.subCategory ||
    undefined
  );
}

function resolveBaseCost(item: SsProduct) {
  const value = item.casePrice ?? item.customerPrice ?? item.piecePrice;
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return 0;
}

export async function syncSsActivewearCatalog(input: {
  tenantId: string;
  storeId?: string;
  limit?: number;
  account?: SsAccount;
}) {
  const accountNumber = input.account?.accountNumber ?? config.ssactivewear.accountNumber;
  const apiKey = input.account?.apiKey ?? config.ssactivewear.apiKey;
  const baseUrl = input.account?.baseUrl ?? config.ssactivewear.baseUrl;

  if (!accountNumber || !apiKey) {
    throw new Error("ssactivewear_credentials_missing");
  }

  const auth = Buffer.from(
    `${accountNumber}:${apiKey}`
  ).toString("base64");

  const url = new URL(`${baseUrl}/products/`);
  if (input.limit) {
    // SSActivewear commonly supports limit + page (offset is optional).
    url.searchParams.set("limit", String(input.limit));
    url.searchParams.set("page", "1");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ssactivewear_request_failed:${response.status}:${body}`);
  }

  const data = (await response.json()) as unknown;
  const products: SsProduct[] = Array.isArray(data)
    ? (data as SsProduct[])
    : ((data as { products?: SsProduct[] }).products ?? []);
  const limitedProducts = input.limit ? products.slice(0, input.limit) : products;
  const groupedByStyle = new Map<string, SsProduct[]>();
  for (const item of limitedProducts) {
    const styleKey = resolveStyleKey(item);
    if (!styleKey) continue;
    const key = String(styleKey);
    const existing = groupedByStyle.get(key) ?? [];
    existing.push(item);
    groupedByStyle.set(key, existing);
  }

  const existingSupplier = await prisma.supplier.findFirst({
    where: { tenantId: input.tenantId, name: "SSActivewear" }
  });
  const supplier = existingSupplier
    ? existingSupplier
    : await prisma.supplier.create({
        data: {
          tenantId: input.tenantId,
          name: "SSActivewear",
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
          name: "SSActivewear Catalog"
        }
      });
      catalogId = created.id;
    }
  }

  const synced: string[] = [];
  for (const [styleKey, items] of groupedByStyle.entries()) {
    const sample = items[0];
    const name = resolveProductName(sample);
    const externalId = styleKey;
    const baseCost = resolveBaseCost(sample);
    const brand = sample.brandName;
    const description = sample.description || sample.styleDescription;
    const category = resolveCategory(sample);
    const productType = category;
    const imageUrl = resolveVariantImage(sample);

    const existing = await prisma.product.findFirst({
      where: {
        tenantId: input.tenantId,
        supplierId: supplier.id,
        externalId
      }
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            brand,
            description,
            category,
            imageUrl,
            productType,
            price: baseCost,
            source: "SSACTIVEWEAR",
            metadata: sample as unknown as Record<string, unknown> as any
          }
        })
      : await prisma.product.create({
          data: {
            tenantId: input.tenantId,
            supplierId: supplier.id,
            name,
            brand,
            description,
            category,
            imageUrl,
            productType,
            price: baseCost,
            source: "SSACTIVEWEAR",
            externalId,
            metadata: sample as unknown as Record<string, unknown> as any
          }
        });

    for (const item of items) {
      const variantExternal = resolveExternalId(item);
      const variantKey = variantExternal ? String(variantExternal) : undefined;
      if (!variantKey) continue;

      const variantBaseCost = resolveBaseCost(item);
      const variantImage = resolveVariantImage(item);
      const size = item.sizeName || item.size;
      const color = item.colorName || item.color;
      const sku = item.sku;

      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, externalId: variantKey }
      });

      if (existingVariant) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            size,
            color,
            sku,
            imageUrl: variantImage,
            baseCost: variantBaseCost,
            metadata: item as unknown as Record<string, unknown> as any
          }
        });
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            externalId: variantKey,
            size,
            color,
            sku,
            imageUrl: variantImage,
            baseCost: variantBaseCost,
            metadata: item as unknown as Record<string, unknown> as any
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
          data: {
            catalogId,
            productId: product.id
          }
        });
      }
    }

    synced.push(product.id);
  }

  return { synced, count: synced.length };
}
