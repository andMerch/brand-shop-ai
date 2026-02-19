const jobs = [
  { id: "JOB-1023", status: "Scanning PDF", progress: "65%" },
  { id: "JOB-1022", status: "Needs Review", progress: "Issue found" },
  { id: "JOB-1021", status: "Complete", progress: "Order created" }
];

export default function AiVisionPage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">AI Vision Agent</span>
          <h1>Reads Every Order Input</h1>
          <p>Process GHL attachments and manual uploads. Validate and route with confidence.</p>
        </div>
        <div className="hero-card">
          <h2>Upload Widget</h2>
          <p>Embed this widget inside GHL for manual uploads.</p>
          <div className="widget">
            <strong>Drop PDF or Image</strong>
            <p>Accepted: PDF, PNG, JPG</p>
            <button className="cta">Upload File</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Recent Jobs</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.status}</td>
                  <td>{job.progress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
