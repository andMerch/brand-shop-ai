import StoreBuilderClient from "./StoreBuilderClient";

const steps = [
  { title: "Distributor Catalog", status: "active" },
  { title: "AI Curation", status: "pending" },
  { title: "Theme & Branding", status: "pending" },
  { title: "Go Live", status: "pending" }
];

export default function StoreBuilderPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">AI Store Builder</span>
          <h1>Launch Stores in Minutes</h1>
          <p>Triggered by GHL workflows, guided by AI, and locked to your brand rules.</p>
        </div>
        <div className="hero-card">
          <h2>Workflow Triggered</h2>
          <p>GHL workflow fires → catalog curated → store ready for review.</p>
          <button className="cta">View Workflow</button>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          <div className="card">
            <strong>Steps</strong>
            <div className="list">
              {steps.map((step) => (
                <div key={step.title}>
                  <span className="tag">{step.status}</span> {step.title}
                </div>
              ))}
            </div>
          </div>
          <StoreBuilderClient />
          <div className="card">
            <strong>Brand Controls</strong>
            <p>Theme presets, pricing rules, and catalog locks applied automatically.</p>
            <button className="cta">Review Controls</button>
          </div>
        </div>
      </section>
    </main>
  );
}
