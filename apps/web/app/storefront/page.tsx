import { headers } from "next/headers";
import StorefrontClient from "./StorefrontClient";

type StorefrontResponse = {
  ok: boolean;
  store?: {
    id: string;
    name: string;
    status: string;
    config: Record<string, unknown>;
  };
  domain?: string;
};

type CatalogResponse = {
  ok: boolean;
  items: Array<{
    id: string;
    name: string;
    brand?: string | null;
    description?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    productType?: string | null;
    baseCost: number;
    price: number;
    variants?: Array<{
      id: string;
      sku?: string | null;
      size?: string | null;
      color?: string | null;
      imageUrl?: string | null;
      baseCost: number;
      price: number;
    }>;
  }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.brand-shop.ai";

async function fetchStorefront(host: string) {
  const response = await fetch(`${apiBase}/api/storefront/resolve?host=${host}`, {
    cache: "no-store"
  });
  if (!response.ok) return null;
  return (await response.json()) as StorefrontResponse;
}

async function fetchCatalog(storeId: string) {
  const response = await fetch(`${apiBase}/api/storefront/${storeId}/catalog`, {
    cache: "no-store"
  });
  if (!response.ok) return null;
  return (await response.json()) as CatalogResponse;
}

export default async function StorefrontPage({
  searchParams
}: {
  searchParams: { host?: string };
}) {
  const host = searchParams.host ?? headers().get("host")?.split(":")[0] ?? "";
  const data = host ? await fetchStorefront(host) : null;

  if (!data?.ok || !data.store) {
    return (
      <main className="container">
        <section className="hero">
          <div>
            <span className="badge">Storefront</span>
            <h1>Store Not Found</h1>
            <p>We could not resolve a store for this domain.</p>
          </div>
        </section>
      </main>
    );
  }

  const catalog = await fetchCatalog(data.store.id);

  return (
    <StorefrontClient
      storeId={data.store.id}
      storeName={data.store.name}
      apiBase={apiBase}
      items={catalog?.items ?? []}
    />
  );
}
