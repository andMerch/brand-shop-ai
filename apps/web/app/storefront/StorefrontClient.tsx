"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  name: string;
  productType?: string | null;
  baseCost: number;
  price: number;
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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [decorationLocations, setDecorationLocations] = useState(1);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cartKey = `brand-shop-cart:${storeId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(cartKey);
      if (saved) {
        setCart(JSON.parse(saved) as Record<string, number>);
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
      }
    };
    fetchCatalog().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [apiBase, storeId, decorationLocations]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = catalog.find((item) => item.id === productId);
        if (!product) return null;
        return { product, quantity };
      })
      .filter(Boolean) as Array<{ product: CatalogItem; quantity: number }>;
  }, [cart, catalog]);

  const subtotal = cartLines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );

  const formatPrice = (value: number) =>
    value.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const nextQty = (next[productId] ?? 0) + delta;
      if (nextQty <= 0) {
        delete next[productId];
      } else {
        next[productId] = nextQty;
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
          {catalog.map((item) => (
            <div className="card" key={item.id}>
              <strong>{item.name}</strong>
              <p className="muted">{item.productType ?? "Catalog Item"}</p>
              <div className="price">{formatPrice(item.price)}</div>
              <div className="row">
                <button className="cta" onClick={() => updateCart(item.id, 1)}>
                  Add to Cart
                </button>
                <button className="ghost" onClick={() => updateCart(item.id, -1)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
