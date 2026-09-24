import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hyphae audit", template: "%s · Hyphae audit" },
  description: "Every contribution, its score, why, and which decision counted.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="top">
          <a href="/" className="brand">
            hyphae<span className="muted"> / audit</span>
          </a>
          <a
            href="https://github.com/FCisco95/hyphae/tree/main/docs/rubrics"
            rel="noopener noreferrer"
          >
            Rubrics
          </a>
        </nav>
        <main>{children}</main>
        <footer className="muted">
          Points are not money. Nothing on this site has been allocated or transferred. All times
          UTC.
        </footer>
      </body>
    </html>
  );
}
