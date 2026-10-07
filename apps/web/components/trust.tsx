import { TRUST_SECTIONS } from "../lib/trust.js";

// The security and trust page: every claim is followed by the file or on-chain record behind it.
export function TrustPage() {
  return (
    <article className="trust-page">
      <header className="page-head">
        <h1>Security and trust</h1>
        <p className="trust-lead">
          What the admin can and cannot do, where the keys are, what is stored about you, and how to
          report a problem. Every statement links to the file or the on-chain record behind it.
        </p>
        <p className="muted small">Last checked 2026-10-07. The same text is in SECURITY.md.</p>
      </header>
      <nav className="trust-toc" aria-label="On this page">
        <ul>
          {TRUST_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      {TRUST_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`}>
          <h2 id={`${s.id}-title`}>{s.title}</h2>
          {s.lead && <p className="trust-section-lead">{s.lead}</p>}
          <ul className="claims">
            {s.claims.map((c) => (
              <li key={c.text}>
                <p>{c.text}</p>
                <p className="claim-evidence small">
                  Evidence:{" "}
                  {c.evidence.map((e, i) => (
                    <span key={e.href}>
                      {i > 0 && " · "}
                      <a href={e.href} rel="noopener noreferrer">
                        {e.label}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
