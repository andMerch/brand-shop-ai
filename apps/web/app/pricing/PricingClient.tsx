"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.brand-shop.ai";

type PricingConfig = {
  model: "DISTRIBUTOR" | "DIRECT";
  decoration: {
    baseFee: number;
    markupFixed: number;
    applyPercentMarkup: boolean;
  };
  distributorMarkupPercent: number;
  checkoutFees: {
    shipping: number;
    taxRate: number;
    ccRate: number;
    platformFee: number;
    platformFeeRate?: number;
    fulfillmentFeeDecorator?: number;
    fulfillmentFeePlatform?: number;
    orderFee?: number;
  };
};

type PricingRule = {
  id: string;
  target: string;
  targetValue?: string | null;
  deltaType: string;
  deltaValue: number;
};

const defaultConfig: PricingConfig = {
  model: "DISTRIBUTOR",
  decoration: {
    baseFee: 7.5,
    markupFixed: 8.5,
    applyPercentMarkup: false
  },
  distributorMarkupPercent: 40,
  checkoutFees: {
    shipping: 7,
    taxRate: 0.07,
    ccRate: 0.03,
    platformFee: 4.94,
    platformFeeRate: 0.03,
    fulfillmentFeeDecorator: 3,
    fulfillmentFeePlatform: 0.5,
    orderFee: 0.79
  }
};

export default function PricingClient() {
  const [scope, setScope] = useState<"GLOBAL" | "TENANT" | "STORE">("TENANT");
  const [scopeId, setScopeId] = useState("");
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [ruleTenantId, setRuleTenantId] = useState("");
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [newRule, setNewRule] = useState({
    target: "CATEGORY",
    targetValue: "",
    deltaType: "PERCENT",
    deltaValue: 0
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setStatus(null);
    setError(null);
    const query = new URLSearchParams({ scope });
    if (scope !== "GLOBAL") {
      if (!scopeId) {
        setError("Scope ID required for TENANT/STORE.");
        return;
      }
      query.set("scopeId", scopeId);
    }
    const response = await fetch(`${apiBase}/api/pricing-config?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to load pricing config.");
      return;
    }
    if (payload.config) {
      setConfig(payload.config);
      setStatus("Loaded pricing config.");
    } else {
      setConfig(defaultConfig);
      setStatus("No saved config. Loaded defaults.");
    }
  };

  const saveConfig = async () => {
    setStatus(null);
    setError(null);
    if (scope !== "GLOBAL" && !scopeId) {
      setError("Scope ID required for TENANT/STORE.");
      return;
    }
    const response = await fetch(`${apiBase}/api/pricing-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        scopeId: scope === "GLOBAL" ? undefined : scopeId,
        config
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to save pricing config.");
      return;
    }
    setStatus("Pricing config saved.");
  };

  const loadRules = async () => {
    setStatus(null);
    setError(null);
    const query = ruleTenantId ? `?tenantId=${ruleTenantId}` : "";
    const response = await fetch(`${apiBase}/api/pricing-rules${query}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to load pricing rules.");
      return;
    }
    setRules(payload.rules ?? []);
  };

  const addRule = async () => {
    setStatus(null);
    setError(null);
    const response = await fetch(`${apiBase}/api/pricing-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: ruleTenantId || undefined,
        target: newRule.target,
        targetValue: newRule.targetValue || undefined,
        deltaType: newRule.deltaType,
        deltaValue: Number(newRule.deltaValue)
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to add rule.");
      return;
    }
    setRules((prev) => [payload.rule, ...prev]);
    setStatus("Rule added.");
  };

  const deleteRule = async (id: string) => {
    setStatus(null);
    setError(null);
    const response = await fetch(`${apiBase}/api/pricing-rules/${id}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Unable to delete rule.");
      return;
    }
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  return (
    <div className="stack">
      <div className="card">
        <strong>Pricing Configuration</strong>
        <div className="list">
          <label className="muted">
            Scope
            <select
              className="select"
              value={scope}
              onChange={(event) => setScope(event.target.value as "GLOBAL" | "TENANT" | "STORE")}
            >
              <option value="GLOBAL">Global</option>
              <option value="TENANT">Distributor (Tenant)</option>
              <option value="STORE">Store</option>
            </select>
          </label>
          {scope !== "GLOBAL" ? (
            <label className="muted">
              Scope ID
              <input
                className="input light"
                value={scopeId}
                onChange={(event) => setScopeId(event.target.value)}
                placeholder="Tenant ID or Store ID"
              />
            </label>
          ) : null}
          <div className="row">
            <button className="ghost" onClick={loadConfig}>
              Load Config
            </button>
            <button className="cta" onClick={saveConfig}>
              Save Config
            </button>
          </div>
          <div className="divider" />
          <label className="muted">
            Distributor Markup %
            <input
              className="input light"
              type="number"
              value={config.distributorMarkupPercent}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  distributorMarkupPercent: Number(event.target.value)
                }))
              }
            />
          </label>
          <div className="row">
            <label className="muted">
              Decoration Base Fee
              <input
                className="input light"
                type="number"
                value={config.decoration.baseFee}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    decoration: { ...prev.decoration, baseFee: Number(event.target.value) }
                  }))
                }
              />
            </label>
            <label className="muted">
              Decoration Markup
              <input
                className="input light"
                type="number"
                value={config.decoration.markupFixed}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    decoration: { ...prev.decoration, markupFixed: Number(event.target.value) }
                  }))
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="muted">
              Platform Fee (Fixed)
              <input
                className="input light"
                type="number"
                value={config.checkoutFees.platformFee}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      platformFee: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
            <label className="muted">
              Platform Fee Rate %
              <input
                className="input light"
                type="number"
                step="0.01"
                value={(config.checkoutFees.platformFeeRate ?? 0) * 100}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      platformFeeRate: Number(event.target.value) / 100
                    }
                  }))
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="muted">
              Fulfillment Fee (Decorator)
              <input
                className="input light"
                type="number"
                value={config.checkoutFees.fulfillmentFeeDecorator ?? 0}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      fulfillmentFeeDecorator: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
            <label className="muted">
              Fulfillment Fee (Brand-Shop)
              <input
                className="input light"
                type="number"
                value={config.checkoutFees.fulfillmentFeePlatform ?? 0}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      fulfillmentFeePlatform: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="muted">
              Order Fee
              <input
                className="input light"
                type="number"
                value={config.checkoutFees.orderFee ?? 0}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      orderFee: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
            <label className="muted">
              Shipping
              <input
                className="input light"
                type="number"
                value={config.checkoutFees.shipping}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      shipping: Number(event.target.value)
                    }
                  }))
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="muted">
              Tax Rate %
              <input
                className="input light"
                type="number"
                step="0.01"
                value={config.checkoutFees.taxRate * 100}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      taxRate: Number(event.target.value) / 100
                    }
                  }))
                }
              />
            </label>
            <label className="muted">
              CC Rate %
              <input
                className="input light"
                type="number"
                step="0.01"
                value={config.checkoutFees.ccRate * 100}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    checkoutFees: {
                      ...prev.checkoutFees,
                      ccRate: Number(event.target.value) / 100
                    }
                  }))
                }
              />
            </label>
          </div>
          {status && <div className="notice success">{status}</div>}
          {error && <div className="notice error">{error}</div>}
        </div>
      </div>

      <div className="card">
        <strong>Pricing Rules</strong>
        <div className="list">
          <label className="muted">
            Tenant ID (blank = global rules)
            <input
              className="input light"
              value={ruleTenantId}
              onChange={(event) => setRuleTenantId(event.target.value)}
              placeholder="Tenant ID"
            />
          </label>
          <button className="ghost" onClick={loadRules}>
            Load Rules
          </button>
          <div className="divider" />
          <div className="row">
            <label className="muted">
              Target
              <select
                className="select"
                value={newRule.target}
                onChange={(event) => setNewRule((prev) => ({ ...prev, target: event.target.value }))}
              >
                <option value="GLOBAL">Global</option>
                <option value="CATEGORY">Category</option>
                <option value="PRODUCT">Product</option>
                <option value="VARIANT">Variant</option>
                <option value="SIZE">Size</option>
                <option value="COLOR">Color</option>
              </select>
            </label>
            <label className="muted">
              Target Value
              <input
                className="input light"
                value={newRule.targetValue}
                onChange={(event) => setNewRule((prev) => ({ ...prev, targetValue: event.target.value }))}
                placeholder="e.g. Hoodie / productId / Red / XL"
              />
            </label>
          </div>
          <div className="row">
            <label className="muted">
              Delta Type
              <select
                className="select"
                value={newRule.deltaType}
                onChange={(event) => setNewRule((prev) => ({ ...prev, deltaType: event.target.value }))}
              >
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed</option>
              </select>
            </label>
            <label className="muted">
              Delta Value
              <input
                className="input light"
                type="number"
                value={newRule.deltaValue}
                onChange={(event) => setNewRule((prev) => ({ ...prev, deltaValue: Number(event.target.value) }))}
              />
            </label>
          </div>
          <button className="cta" onClick={addRule}>
            Add Rule
          </button>
          <div className="divider" />
          <div className="list">
            {rules.length === 0 ? (
              <div className="muted">No rules loaded.</div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="row">
                  <div>
                    <strong>{rule.target}</strong>{" "}
                    {rule.targetValue ? `(${rule.targetValue})` : ""}
                    {" · "}
                    {rule.deltaType} {rule.deltaValue}
                  </div>
                  <button className="ghost" onClick={() => deleteRule(rule.id)}>
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
