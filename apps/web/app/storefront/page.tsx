import { headers } from "next/headers";

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
    productType?: string | null;
    baseCost: number;
    price: number;
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
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Brand-Shop Storefront</span>
          <h1>{data.store.name}</h1>
          <p>Powered by GHL checkout and Brand-Shop pricing rules.</p>
        </div>
        <div className="hero-card">
          <h2>Checkout</h2>
          <p>Checkout is managed in GoHighLevel. Add to cart coming soon.</p>
          <button className="cta">Request Quote</button>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          {(catalog?.items ?? []).map((item) => (
            <div className="card" key={item.id}>
              <strong>{item.name}</strong>
              <p className="muted">{item.productType ?? "Catalog Item"}</p>
              <div className="price">${item.price.toFixed(2)}</div>
              <button className="cta">Add to Cart</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
