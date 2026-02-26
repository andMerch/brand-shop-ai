"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

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
  placement?: string;
};

type DecorationType = "PUFF" | "DTG" | "NONE";

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

const placements = Object.keys(placementPresets) as Array<keyof typeof placementPresets>;

type Layer = {
  id: string;
  placement: keyof typeof placementPresets;
  x: number;
  y: number;
  widthRatio: number;
  decoration: DecorationType;
  logoUrl?: string;
};

const makeLayer = (placement: keyof typeof placementPresets): Layer => {
  const preset = placementPresets[placement];
  return {
    id: `${placement}-${Math.random().toString(36).slice(2)}`,
    placement,
    x: preset.x,
    y: preset.y,
    widthRatio: preset.widthRatio,
    decoration: "PUFF"
  };
};

export default function MockupsClient() {
  const [host, setHost] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [placement, setPlacement] = useState<keyof typeof placementPresets>("FULL_FRONT");
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MockupResult[]>([]);
  const [layers, setLayers] = useState<Layer[]>([makeLayer("FULL_FRONT")]);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoColors, setAutoColors] = useState<string[]>([]);
  const [autoSizes, setAutoSizes] = useState<string[]>([]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

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

  const palette = useMemo(() => {
    const colors = new Set<string>();
    const sizes = new Set<string>();
    for (const product of catalog) {
      for (const variant of product.variants) {
        if (variant.color) colors.add(variant.color);
        if (variant.size) sizes.add(variant.size);
      }
    }
    return {
      colors: Array.from(colors).sort(),
      sizes: Array.from(sizes).sort()
    };
  }, [catalog]);

  const formatError = (payload: any, fallback: string) => {
    if (!payload) return fallback;
    if (typeof payload === "string" && payload.trim()) return payload;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (payload.error) return JSON.stringify(payload.error);
    return fallback;
  };

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
    const mockupSettings = payload.store?.config?.mockups ?? {};
    setLogoUrl(brandLogo);
    setAutoGenerate(Boolean(mockupSettings.autoGenerate));
    setAutoColors((mockupSettings.autoColors as string[]) ?? []);
    setAutoSizes((mockupSettings.autoSizes as string[]) ?? []);
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

  const updateLayer = (id: string, patch: Partial<Layer>) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? {
              ...layer,
              ...patch
            }
          : layer
      )
    );
  };

  const snapLayer = (id: string, nextPlacement: keyof typeof placementPresets) => {
    const preset = placementPresets[nextPlacement];
    updateLayer(id, {
      placement: nextPlacement,
      x: preset.x,
      y: preset.y,
      widthRatio: preset.widthRatio
    });
  };

  const addLayer = () => {
    setLayers((prev) => [...prev, makeLayer(placement)]);
  };

  const removeLayer = (id: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== id));
  };

  const startDrag = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const layer = layers.find((entry) => entry.id === id);
    if (!layer) return;

    dragState.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: layer.x * rect.width,
      originY: layer.y * rect.height
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!previewRef.current || !dragState.current) return;
      const { id: activeId, startX, startY, originX, originY } = dragState.current;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const rect = previewRef.current.getBoundingClientRect();
      const nextX = Math.min(1, Math.max(0, (originX + dx) / rect.width));
      const nextY = Math.min(1, Math.max(0, (originY + dy) / rect.height));
      updateLayer(activeId, { x: nextX, y: nextY });
    };

    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const saveAutoSettings = async (resolvedLogoUrl: string) => {
    if (!storeId) return;
    await fetch(`${apiBase}/api/storefront/mockups/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        autoGenerate,
        autoPlacements: [placement],
        autoColors,
        autoSizes,
        decoration: layers[0]?.decoration ?? "PUFF",
        logoUrl: resolvedLogoUrl
      })
    });
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

    const payloadLayers = layers.map((layer) => ({
      placement: layer.placement,
      x: layer.x,
      y: layer.y,
      widthRatio: layer.widthRatio,
      decoration: layer.decoration,
      logoUrl: layer.logoUrl || resolvedLogoUrl
    }));

    const response = await fetch(`${apiBase}/api/storefront/mockups/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        productId,
        variantId: variantId || undefined,
        placement,
        layers: payloadLayers,
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
    await saveAutoSettings(resolvedLogoUrl);
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
              onChange={(event) => setPlacement(event.target.value as keyof typeof placementPresets)}
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
              <div
                className="image-frame"
                ref={previewRef}
                style={{ position: "relative", overflow: "hidden" }}
              >
                <img src={previewImage} alt="Product preview" />
                {layers.map((layer) => {
                  const src = layer.logoUrl || logoUrl;
                  if (!src) return null;
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: "absolute",
                        left: `${layer.x * 100}%`,
                        top: `${layer.y * 100}%`,
                        width: `${layer.widthRatio * 100}%`,
                        transform: "translate(-50%, -50%)",
                        cursor: "grab"
                      }}
                      onPointerDown={(event) => startDrag(layer.id, event)}
                    >
                      <img
                        src={src}
                        alt="Logo preview"
                        style={{ width: "100%", height: "auto", display: "block" }}
                      />
                    </div>
                  );
                })}
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

      <section className="card">
        <h3>Logo Layers</h3>
        <div className="stack">
          {layers.map((layer, index) => (
            <div key={layer.id} className="stack" style={{ padding: "0.75rem", border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="row">
                <strong>Layer {index + 1}</strong>
                {layers.length > 1 && (
                  <button className="ghost" type="button" onClick={() => removeLayer(layer.id)}>
                    Remove
                  </button>
                )}
              </div>
              <label>
                Placement
                <select
                  className="select"
                  value={layer.placement}
                  onChange={(event) =>
                    snapLayer(layer.id, event.target.value as keyof typeof placementPresets)
                  }
                >
                  {placements.map((item) => (
                    <option key={item} value={item}>
                      {item.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decoration
                <select
                  className="select"
                  value={layer.decoration}
                  onChange={(event) =>
                    updateLayer(layer.id, { decoration: event.target.value as DecorationType })
                  }
                >
                  <option value="PUFF">Embroidery (Puff)</option>
                  <option value="DTG">DTG</option>
                  <option value="NONE">None</option>
                </select>
              </label>
              <label>
                Size
                <input
                  className="input light"
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.01}
                  value={layer.widthRatio}
                  onChange={(event) =>
                    updateLayer(layer.id, { widthRatio: Number(event.target.value) })
                  }
                />
              </label>
              <div className="row">
                <label style={{ flex: 1 }}>
                  Logo URL override (optional)
                  <input
                    className="input light"
                    value={layer.logoUrl ?? ""}
                    placeholder="https://..."
                    onChange={(event) =>
                      updateLayer(layer.id, { logoUrl: event.target.value })
                    }
                  />
                </label>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => snapLayer(layer.id, layer.placement)}
                >
                  Snap to placement
                </button>
              </div>
            </div>
          ))}
          <button className="ghost" type="button" onClick={addLayer}>
            Add Logo Layer
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Auto-Generate Settings</h3>
        <p>Automatically create mockups for selected colors/sizes when the catalog syncs.</p>
        <label className="row" style={{ justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(event) => setAutoGenerate(event.target.checked)}
          />
          Enable auto-generation on catalog sync
        </label>
        <div className="stack" style={{ marginTop: "0.8rem" }}>
          <div>
            <strong>Colors</strong>
            <div className="card-grid">
              {palette.colors.map((color) => (
                <label key={color} className="tag" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={autoColors.includes(color)}
                    onChange={(event) => {
                      setAutoColors((prev) =>
                        event.target.checked
                          ? [...prev, color]
                          : prev.filter((item) => item !== color)
                      );
                    }}
                  />
                  {color}
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong>Sizes</strong>
            <div className="card-grid">
              {palette.sizes.map((size) => (
                <label key={size} className="tag" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={autoSizes.includes(size)}
                    onChange={(event) => {
                      setAutoSizes((prev) =>
                        event.target.checked
                          ? [...prev, size]
                          : prev.filter((item) => item !== size)
                      );
                    }}
                  />
                  {size}
                </label>
              ))}
            </div>
          </div>
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
                {result.placement && <div className="tag">{result.placement.replace("_", " ")}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
