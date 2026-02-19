const reviews = [
  { name: "Lincoln High School", rating: 5, status: "Responded" },
  { name: "Grace Community Church", rating: 4, status: "Pending" },
  { name: "TechCorp Inc.", rating: 5, status: "Responded" }
];

export default function ReputationPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Reputation</span>
          <h1>Reputation at a Glance</h1>
          <p>Track ratings and trigger review requests from inside GHL.</p>
        </div>
        <div className="hero-card">
          <h2>Average Rating</h2>
          <h1>4.8</h1>
          <p>Based on 218 reviews this quarter</p>
          <button className="cta">Send Review Request</button>
        </div>
      </section>

      <section className="section">
        <h2>Recent Reviews</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Rating</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.name}>
                  <td>{review.name}</td>
                  <td>{"★".repeat(review.rating)}</td>
                  <td><span className="tag">{review.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
