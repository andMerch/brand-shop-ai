import PricingClient from "./PricingClient";

export default function PricingPage() {
  return (
    <main className="container">
      <section className="section">
        <h1>Distributor Pricing</h1>
        <p className="muted">
          Configure pricing at global, distributor, or store level. Add rules to
          apply markups by category, product, size, or color.
        </p>
      </section>
      <PricingClient />
    </main>
  );
}
