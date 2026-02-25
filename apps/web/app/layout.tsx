import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Brand-Shop AI Embedded",
  description: "Embedded AI operations suite for GHL"
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/store-builder", label: "AI Store Builder" },
  { href: "/pricing", label: "Pricing" },
  { href: "/mockups", label: "Mockup Studio" },
  { href: "/ai-vision", label: "AI Vision" },
  { href: "/order-routing", label: "Order Routing" },
  { href: "/reputation", label: "Reputation" },
  { href: "/integrations", label: "Integrations" }
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <header className="topbar">
            <div className="brand">BRAND-SHOP.AI OPS</div>
            <nav className="nav-links">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
