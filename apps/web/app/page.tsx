export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Embedded in GoHighLevel</span>
          <h1>AI Operations Suite for Distributors</h1>
          <p>
            Launch AI Store Builder, AI Vision, routing, and reporting directly inside your GHL
            portal. Everything here is designed to be embedded as an iframe module.
          </p>
          <button className="cta">Open Dashboard</button>
        </div>
        <div className="hero-card">
          <h2>System Status</h2>
          <p>GHL is the system of record. Our services orchestrate AI Vision, routing, and analytics.</p>
          <div className="card-grid">
            <div className="card">
              <strong>AI Vision</strong>
              <p>Listening to GHL attachments + upload widget.</p>
            </div>
            <div className="card">
              <strong>AI Support</strong>
              <p>GHL AI Voice + GHL AI Chat enabled.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Embedded Modules</h2>
        <div className="card-grid">
          <a className="card" href="/dashboard">
            <strong>Distributor Dashboard</strong>
            <p>Real-time revenue, orders, AI support load, and routing performance.</p>
          </a>
          <a className="card" href="/store-builder">
            <strong>AI Store Builder</strong>
            <p>Workflow-triggered store configs with AI product suggestions.</p>
          </a>
          <a className="card" href="/ai-vision">
            <strong>AI Vision Agent</strong>
            <p>Ingest emails, PDFs, and images. Detect issues before routing.</p>
          </a>
          <a className="card" href="/order-routing">
            <strong>Order Routing</strong>
            <p>Automated routing with manual override and rule management.</p>
          </a>
          <a className="card" href="/reputation">
            <strong>Reputation</strong>
            <p>Track ratings and trigger requests directly from GHL.</p>
          </a>
          <a className="card" href="/integrations">
            <strong>Integrations</strong>
            <p>Demo connectors for Printavo, DecoNetwork, InkSoft, and more.</p>
          </a>
        </div>
      </section>
    </main>
  );
}
