import { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";

const demoIntegrations = [
  { key: "ssactivewear", name: "SSActivewear", status: config.ssactivewear.apiKey ? "connected" : "missing" },
  { key: "printful", name: "Printful", status: config.printful.apiKey ? "connected" : "missing" },
  { key: "shipstation", name: "ShipStation", status: "handled-in-ghl" },
  { key: "taxjar", name: "TaxJar", status: "handled-in-ghl" },
  { key: "printavo", name: "Printavo", status: "demo" },
  { key: "deconetwork", name: "DecoNetwork", status: "demo" },
  { key: "inksoft", name: "InkSoft", status: "demo" },
  { key: "sanmar", name: "SanMar", status: "demo" },
  { key: "zapier", name: "Zapier", status: "demo" }
];

export async function integrationsRoutes(app: FastifyInstance) {
  app.get("/api/integrations/status", async () => {
    return { ok: true, integrations: demoIntegrations };
  });
}
