"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogVariant = {
  id: string;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  baseCost: number;
  price: number;
};

type CatalogItem = {
  id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  productType?: string | null;
  baseCost: number;
  price: number;
  variants?: CatalogVariant[];
};

type StorefrontClientProps = {
  storeId: string;
  storeName: string;
  apiBase: string;
  items: CatalogItem[];
};

type CheckoutResult = {
  orderId: string;
  total: number;
  currency: string;
};

export default function StorefrontClient({
  storeId,
  storeName,
  apiBase,
  items
}: StorefrontClientProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>(items);
  const [cart, setCart] = useState<Record<string, { variantId?: string; quantity: number }>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [optionSelection, setOptionSelection] = useState<
    Record<string, { color?: string; size?: string }>
  >({});
  const [decorationLocations, setDecorationLocations] = useState(1);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cartKey = `brand-shop-cart:${storeId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(cartKey);
      if (saved) {
        setCart(JSON.parse(saved) as Record<string, { variantId?: string; quantity: number }>);
      }
    } catch {
      // ignore malformed local storage
    }
  }, [cartKey]);

  useEffect(() => {
    window.localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cartKey, cart]);

  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      const response = await fetch(
        `${apiBase}/api/storefront/${storeId}/catalog?locations=${decorationLocations}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as { items: CatalogItem[] };
      if (active && data.items) {
        setCatalog(data.items);
        setSelection((prev) => {
          const next = { ...prev };
          for (const item of data.items) {
            if (!next[item.id] && item.variants?.length) {
              next[item.id] = item.variants[0].id;
            }
          }
          return next;
        });
        setOptionSelection((prev) => {
          const next = { ...prev };
          for (const item of data.items) {
            if (!next[item.id] && item.variants?.length) {
              next[item.id] = {
                color: item.variants[0].color ?? undefined,
                size: item.variants[0].size ?? undefined
              };
            }
          }
          return next;
        });
      }
    };
    fetchCatalog().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [apiBase, storeId, decorationLocations]);

  useEffect(() => {
    setSelection((prev) => {
      const next = { ...prev };
      for (const item of catalog) {
        const selected = optionSelection[item.id];
        const selectedColor = selected?.color;
        const selectedSize = selected?.size;
        const variant =
          item.variants?.find(
            (entry) =>
              (!selectedColor || entry.color === selectedColor) &&
              (!selectedSize || entry.size === selectedSize)
          ) ??
          item.variants?.[0];
        if (variant) {
          next[item.id] = variant.id;
        }
      }
      return next;
    });
  }, [catalog, optionSelection]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, entry]) => {
        const product = catalog.find((item) => item.id === productId);
        if (!product) return null;
        const variantId = entry.variantId ?? selection[productId];
        const variant =
          product.variants?.find((entry) => entry.id === variantId) ??
          product.variants?.[0] ??
          null;
        return { product, quantity: entry.quantity, variant };
      })
      .filter(Boolean) as Array<{ product: CatalogItem; quantity: number; variant: CatalogVariant | null }>;
  }, [cart, catalog, selection]);

  const subtotal = cartLines.reduce(
    (sum, line) => {
      const price = line.variant?.price ?? line.product.price;
      return sum + price * line.quantity;
    },
    0
  );

  const formatPrice = (value: number) =>
    value.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[productId];
      const currentQty = current?.quantity ?? 0;
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        delete next[productId];
      } else {
        next[productId] = {
          variantId: selection[productId],
          quantity: nextQty
        };
      }
      return next;
    });
  };

  const handleCheckout = async () => {
    if (!cartLines.length) return;
    setIsCheckingOut(true);
    setError(null);
    setCheckoutResult(null);

    try {
      const response = await fetch(`${apiBase}/api/storefront/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          items: cartLines.map((line) => ({
            productId: line.product.id,
            variantId: line.variant?.id,
            quantity: line.quantity
          })),
          decorationLocations
        })
      });

      const payload = (await response.json()) as { ok?: boolean } & CheckoutResult & {
          error?: string;
        };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "checkout_failed");
      }

      setCheckoutResult({
        orderId: payload.orderId,
        total: payload.total,
        currency: payload.currency
      });
      setCart({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Brand-Shop Storefront</span>
          <h1>{storeName}</h1>
          <p>Choose your items and submit the order to start checkout.</p>
        </div>
        <div className="hero-card">
          <h2>Cart</h2>
          <div className="stack">
            <label className="muted">
              Decoration locations
              <input
                className="input"
                type="number"
                min={1}
                value={decorationLocations}
                onChange={(event) =>
                  setDecorationLocations(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <div className="cart-summary">
              <div className="row">
                <span>Items</span>
                <strong>{cartLines.reduce((sum, line) => sum + line.quantity, 0)}</strong>
              </div>
              <div className="row">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
            </div>
            <button className="cta" onClick={handleCheckout} disabled={isCheckingOut}>
              {isCheckingOut ? "Processing..." : "Checkout"}
            </button>
            {checkoutResult && (
              <div className="notice">
                Order <strong>{checkoutResult.orderId}</strong> created. Total:{" "}
                <strong>{formatPrice(checkoutResult.total)}</strong>
              </div>
            )}
            {error && <div className="notice error">Checkout failed: {error}</div>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          {catalog.map((item) => {
            const selectedOptions = optionSelection[item.id] ?? {};
            const colors = Array.from(
              new Set(
                (item.variants ?? [])
                  .map((entry) => entry.color)
                  .filter(Boolean) as string[]
              )
            );
            const selectedColor = selectedOptions.color ?? colors[0];
            const sizes = Array.from(
              new Set(
                (item.variants ?? [])
                  .filter((entry) =>
                    selectedColor ? entry.color === selectedColor : true
                  )
                  .map((entry) => entry.size)
                  .filter(Boolean) as string[]
              )
            );
            const selectedSize = selectedOptions.size ?? sizes[0];
            const variant =
              item.variants?.find(
                (entry) =>
                  (!selectedColor || entry.color === selectedColor) &&
                  (!selectedSize || entry.size === selectedSize)
              ) ?? item.variants?.[0];

            const displayPrice = variant?.price ?? item.price;
            const imageUrl = variant?.imageUrl ?? item.imageUrl;

            return (
              <div className="card" key={item.id}>
                {imageUrl ? (
                  <div className="image-frame">
                    <img src={imageUrl} alt={item.name} />
                  </div>
                ) : null}
                <strong>{item.name}</strong>
                <p className="muted">
                  {item.brand ? `${item.brand} · ` : ""}
                  {item.category ?? item.productType ?? "Catalog Item"}
                </p>
                {item.description ? <p className="muted">{item.description}</p> : null}
                <div className="price">{formatPrice(displayPrice)}</div>
                {colors.length > 0 ? (
                  <label className="muted">
                    Color
                    <select
                      className="select"
                      value={selectedColor}
                      onChange={(event) => {
                        const nextColor = event.target.value;
                        setOptionSelection((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], color: nextColor }
                        }));
                      }}
                    >
                      {colors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {sizes.length > 0 ? (
                  <label className="muted">
                    Size
                    <select
                      className="select"
                      value={selectedSize}
                      onChange={(event) => {
                        const nextSize = event.target.value;
                        setOptionSelection((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], size: nextSize }
                        }));
                      }}
                    >
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="row">
                  <button className="cta" onClick={() => updateCart(item.id, 1)}>
                    Add to Cart
                  </button>
                  <button className="ghost" onClick={() => updateCart(item.id, -1)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
