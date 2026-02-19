const kpis = [
  { label: "Revenue", value: "$112,240", delta: "+12.5%" },
  { label: "Orders", value: "811", delta: "+8.3%" },
  { label: "Active Stores", value: "24", delta: "+2" },
  { label: "AOV", value: "$138.40", delta: "+4.2%" }
];

const stores = [
  { name: "Lincoln High School", orders: 45, status: "Active" },
  { name: "Grace Community Church", orders: 28, status: "Active" },
  { name: "TechCorp Inc.", orders: 156, status: "Active" }
];

export default function DashboardPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Distributor Dashboard</span>
          <h1>Real-Time Business Intelligence</h1>
          <p>Monitor revenue, orders, routing performance, and AI support load across all stores.</p>
        </div>
        <div className="hero-card">
          <h2>AI Support Load</h2>
          <p>47 active conversations across channels</p>
          <div className="card-grid">
            <div className="card">
              <strong>Voice</strong>
              <p>18 calls handled</p>
            </div>
            <div className="card">
              <strong>Chat</strong>
              <p>22 sessions</p>
            </div>
            <div className="card">
              <strong>Social</strong>
              <p>7 inbox threads</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="card">
              <strong>{kpi.label}</strong>
              <h2>{kpi.value}</h2>
              <span className="badge">{kpi.delta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Your Client Stores</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Orders</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.name}>
                  <td>{store.name}</td>
                  <td>{store.orders}</td>
                  <td><span className="tag">{store.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
