"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.brand-shop.ai";

export default function StoreBuilderClient() {
  const [locationId, setLocationId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [clientName, setClientName] = useState("");
  const [brandVertical, setBrandVertical] = useState("");
  const [pricingModel, setPricingModel] = useState<"DISTRIBUTOR" | "DIRECT">("DISTRIBUTOR");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${apiBase}/api/store-builder/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ghl-webhook-secret": webhookSecret
        },
        body: JSON.stringify({
          locationId,
          storeName,
          clientName,
          brandVertical,
          pricingModel
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "store_builder_failed");
      }

      setResult(`Store created: ${payload.storeId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <strong>Trigger Store Build</strong>
      <div className="list">
        <label className="muted">
          Location ID
          <input
            className="input light"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            placeholder="GHL location ID"
          />
        </label>
        <label className="muted">
          Store Name
          <input
            className="input light"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            placeholder="Store name"
          />
        </label>
        <label className="muted">
          Client Name
          <input
            className="input light"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Client / brand name"
          />
        </label>
        <label className="muted">
          Brand Vertical
          <input
            className="input light"
            value={brandVertical}
            onChange={(event) => setBrandVertical(event.target.value)}
            placeholder="Apparel, Swag, Corporate"
          />
        </label>
        <label className="muted">
          Pricing Model
          <select
            className="select"
            value={pricingModel}
            onChange={(event) => setPricingModel(event.target.value as "DISTRIBUTOR" | "DIRECT")}
          >
            <option value="DISTRIBUTOR">Distributor</option>
            <option value="DIRECT">Direct</option>
          </select>
        </label>
        <label className="muted">
          Webhook Secret
          <input
            className="input light"
            type="password"
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
            placeholder="GHL webhook secret"
          />
        </label>
        <button className="cta" onClick={handleSubmit} disabled={loading}>
          {loading ? "Building..." : "Trigger Build"}
        </button>
        {result && <div className="notice success">{result}</div>}
        {error && <div className="notice error">{error}</div>}
      </div>
    </div>
  );
}
