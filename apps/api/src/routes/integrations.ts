import { FastifyInstance } from "fastify";

const demoIntegrations = [
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
