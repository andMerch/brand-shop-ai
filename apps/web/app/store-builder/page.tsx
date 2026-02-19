const steps = [
  { title: "Organization Type", status: "complete" },
  { title: "AI Product Suggestions", status: "active" },
  { title: "Choose Theme", status: "pending" },
  { title: "Go Live", status: "pending" }
];

const suggestions = [
  { name: "Spirit T-Shirts", meta: "Trending" },
  { name: "Team Hoodies", meta: "Seasonal" },
  { name: "Baseball Caps", meta: "Regional" },
  { name: "Staff Polos", meta: "Requested" }
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
          <p>GHL workflow fires → AI generates catalog → store ready for review.</p>
          <button className="cta">Trigger Build</button>
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
          <div className="card">
            <strong>AI Suggestions</strong>
            <div className="list">
              {suggestions.map((item) => (
                <div key={item.name}>
                  {item.name} <span className="tag">{item.meta}</span>
                </div>
              ))}
            </div>
          </div>
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
