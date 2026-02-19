const rules = [
  { id: "R-01", type: "By Product Type", match: "Apparel", decorator: "PrintMax Pro" },
  { id: "R-02", type: "By Supplier", match: "SanMar", decorator: "StitchCraft" },
  { id: "R-03", type: "By Decoration", match: "Embroidery", decorator: "PromoHub" }
];

const routingStream = [
  { order: "ORD-001", product: "Custom T-Shirts", routedTo: "PrintMax Pro" },
  { order: "ORD-002", product: "Embroidered Polos", routedTo: "StitchCraft" },
  { order: "ORD-003", product: "Branded Pens", routedTo: "PromoHub" }
];

export default function OrderRoutingPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Order Routing</span>
          <h1>Every Order Routed Automatically</h1>
          <p>Set rules once. AI routes by product, supplier, or decoration method.</p>
        </div>
        <div className="hero-card">
          <h2>Routing Engine</h2>
          <p>2 of 3 orders routed today</p>
          <button className="cta">Create Rule</button>
        </div>
      </section>

      <section className="section">
        <h2>Active Rules</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Match</th>
                <th>Decorator</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.id}</td>
                  <td>{rule.type}</td>
                  <td>{rule.match}</td>
                  <td>{rule.decorator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Routing Stream</h2>
        <div className="card-grid">
          {routingStream.map((event) => (
            <div key={event.order} className="card">
              <strong>{event.order}</strong>
              <p>{event.product}</p>
              <span className="badge">{event.routedTo}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
