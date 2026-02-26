"use client";

import { useMemo, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.brand-shop.ai";

type CatalogVariant = {
  id: string;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  price?: number | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  variants: CatalogVariant[];
};

type MockupResult = {
  variantId: string | null;
  imageUrl: string;
};

const placements = [
  "LEFT_CHEST",
  "RIGHT_CHEST",
  "FULL_FRONT",
  "FULL_BACK",
  "BACK"
] as const;

type Placement = (typeof placements)[number];

export default function MockupsClient() {
  const [host, setHost] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [placement, setPlacement] = useState<Placement>("FULL_FRONT");
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MockupResult[]>([]);

  const formatError = (payload: any, fallback: string) => {
    if (!payload) return fallback;
    if (typeof payload === "string" && payload.trim()) return payload;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (payload.error) return JSON.stringify(payload.error);
    return fallback;
  };

  const selectedProduct = useMemo(
    () => catalog.find((product) => product.id === productId) ?? null,
    [catalog, productId]
  );
  const variants = selectedProduct?.variants ?? [];
  const previewImage = useMemo(() => {
    if (!selectedProduct) return null;
    const selectedVariant = variants.find((variant) => variant.id === variantId);
    return (
      selectedVariant?.imageUrl ||
      selectedProduct.imageUrl ||
      (variants.length ? variants[0]?.imageUrl : null)
    );
  }, [selectedProduct, variants, variantId]);

  const resolveStore = async () => {
    setStatus(null);
    setError(null);
    if (!host.trim()) {
      setError("Enter the storefront domain to resolve.");
      return;
    }
    const response = await fetch(
      `${apiBase}/api/storefront/resolve?host=${encodeURIComponent(host.trim())}`
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(formatError(payload, "Unable to resolve storefront domain."));
      return;
    }
    setStoreId(payload.store?.id ?? "");
    setStoreName(payload.store?.name ?? null);
    const brandLogo = payload.store?.config?.brand?.logoUrl ?? "";
    setLogoUrl(brandLogo);
    setStatus("Store resolved.");
  };

  const loadCatalog = async () => {
    setStatus(null);
    setError(null);
    setResults([]);
    if (!storeId) {
      setError("Store ID is required to load catalog.");
      return;
    }
    const response = await fetch(
      `${apiBase}/api/storefront/${storeId}/catalog?placement=${placement}`
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(formatError(payload, "Unable to load catalog."));
      return;
    }
    const items = (payload.items ?? []) as CatalogProduct[];
    setCatalog(items);
    if (items.length) {
      setProductId(items[0].id);
      setVariantId("");
    }
    setStatus(`Loaded ${items.length} items.`);
  };

  const uploadLogo = async () => {
    setStatus(null);
    setError(null);
    if (!storeId) {
      setError("Store ID is required to upload a logo.");
      return;
    }
    if (!logoFile) {
      setError("Select a logo file first.");
      return;
    }
    const form = new FormData();
    form.append("file", logoFile);
    const response = await fetch(
      `${apiBase}/api/storefront/logo?storeId=${encodeURIComponent(storeId)}`,
      {
        method: "POST",
        body: form
      }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(formatError(payload, "Unable to upload logo."));
      return;
    }
    setLogoUrl(payload.logoUrl ?? "");
    setStatus("Logo uploaded and saved to store.");
  };

  const ensureLogoUrl = async () => {
    if (logoUrl.trim()) return logoUrl.trim();
    if (!logoFile) return "";
    try {
      const form = new FormData();
      form.append("file", logoFile);
      const response = await fetch(
        `${apiBase}/api/storefront/logo?storeId=${encodeURIComponent(storeId)}`,
        {
          method: "POST",
          body: form
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(formatError(payload, "Unable to upload logo."));
        return "";
      }
      setLogoUrl(payload.logoUrl ?? "");
      setStatus("Logo uploaded and saved to store.");
      return payload.logoUrl ?? "";
    } catch (err) {
      setError("Unable to upload logo.");
      return "";
    }
  };

  const generateMockups = async () => {
    setStatus(null);
    setError(null);
    if (!storeId) {
      setError("Store ID is required.");
      return;
    }
    if (!productId) {
      setError("Select a product.");
      return;
    }
    const resolvedLogoUrl = await ensureLogoUrl();
    if (!resolvedLogoUrl) {
      setError("Upload a logo or provide a logo URL before generating mockups.");
      return;
    }
    const response = await fetch(`${apiBase}/api/storefront/mockups/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        productId,
        variantId: variantId || undefined,
        placement,
        logoUrl: resolvedLogoUrl || undefined,
        overwrite
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(formatError(payload, "Mockup generation failed."));
      return;
    }
    const nextResults = payload.results ?? [];
    if (!nextResults.length) {
      setError(
        "No base product images were found for this selection. Try another product or variant, or re-sync the catalog with images."
      );
      return;
    }
    setResults(nextResults);
    setStatus(`Mockups generated: ${nextResults.length}.`);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Mockup Studio</h2>
        <p>
          Upload a logo, pick a product, and generate mockups by placement. These
          mockups feed the storefront catalog images.
        </p>
        <div className="stack">
          <div>
            <label>
              Storefront domain
              <input
                className="input light"
                placeholder="brand-shop-ai-store.brand-shop.ai"
                value={host}
                onChange={(event) => setHost(event.target.value)}
              />
            </label>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>
                Store ID
                <input
                  className="input light"
                  placeholder="Store ID"
                  value={storeId}
                  onChange={(event) => setStoreId(event.target.value)}
                />
              </label>
            </div>
            <button className="ghost" type="button" onClick={resolveStore}>
              Resolve Store
            </button>
          </div>
          {storeName && (
            <div className="notice success">Resolved store: {storeName}</div>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Catalog + Placement</h3>
        <div className="row">
          <label style={{ flex: 1 }}>
            Placement
            <select
              className="select"
              value={placement}
              onChange={(event) => setPlacement(event.target.value as Placement)}
            >
              {placements.map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost" type="button" onClick={loadCatalog}>
            Load Catalog
          </button>
        </div>
        {catalog.length > 0 && (
          <div className="stack">
            <label>
              Product
              <select
                className="select"
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setVariantId("");
                }}
              >
                {catalog.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Variant (optional)
              <select
                className="select"
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
              >
                <option value="">All variants</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.size || "One Size"} · {variant.color || "Color"}
                  </option>
                ))}
              </select>
            </label>
            {previewImage && (
              <div className="image-frame">
                <img src={previewImage} alt="Product preview" />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Logo + Generate</h3>
        <div className="stack">
          <label>
            Current logo URL (optional override)
            <input
              className="input light"
              placeholder="https://..."
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </label>
          <div className="row">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
            <button className="ghost" type="button" onClick={uploadLogo}>
              Upload Logo
            </button>
          </div>
          <label className="row" style={{ justifyContent: "flex-start" }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(event) => setOverwrite(event.target.checked)}
            />
            Overwrite existing mockups
          </label>
          <button className="cta" type="button" onClick={generateMockups}>
            Generate Mockups
          </button>
        </div>
      </section>

      {(status || error) && (
        <div className={`notice ${error ? "error" : "success"}`}>
          {error ?? status}
        </div>
      )}

      {results.length > 0 && (
        <section className="section">
          <h3>Generated Mockups</h3>
          <div className="card-grid">
            {results.map((result) => (
              <div key={`${result.variantId ?? "product"}-${result.imageUrl}`} className="card">
                <div className="badge">
                  {result.variantId ? "Variant" : "Product"}
                </div>
                <div className="image-frame">
                  <img src={result.imageUrl} alt="Mockup result" />
                </div>
                <div className="tag">{result.variantId ?? "All"}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
