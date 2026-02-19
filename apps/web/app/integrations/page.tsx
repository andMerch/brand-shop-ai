const integrations = [
  { name: "Printavo", type: "Order Management", status: "Demo" },
  { name: "DecoNetwork", type: "Order Management", status: "Demo" },
  { name: "InkSoft", type: "Store Platform", status: "Demo" },
  { name: "SanMar", type: "Supplier", status: "Demo" },
  { name: "Zapier", type: "Automation", status: "Demo" }
];

export default function IntegrationsPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Integrations</span>
          <h1>Connect Your Stack</h1>
          <p>Demo connectors are ready. Activate live integrations as needed.</p>
        </div>
        <div className="hero-card">
          <h2>Integration Hub</h2>
          <p>Use our API to sync with your existing systems.</p>
          <button className="cta">Request Live Integration</button>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          {integrations.map((integration) => (
            <div key={integration.name} className="card">
              <strong>{integration.name}</strong>
              <p>{integration.type}</p>
              <span className="badge">{integration.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
