import type { ReactNode } from "react";

// The design system's components. Styles live in app/globals.css under the same names.

export function ButtonLink({
  href,
  secondary = false,
  children,
}: {
  href: string;
  secondary?: boolean;
  children: ReactNode;
}) {
  return (
    <a className={secondary ? "button button-secondary" : "button"} href={href}>
      {children}
    </a>
  );
}

// final: settled. open: in progress. absent: not confirmed, or not counted.
export type Tone = "final" | "open" | "absent";

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Stats({ compact = false, children }: { compact?: boolean; children: ReactNode }) {
  return <dl className={compact ? "facts" : "stats"}>{children}</dl>;
}

export function Stat({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span className="stat-note">{note}</span>}
      </dd>
    </div>
  );
}

// A hash, signature or address that opens its proof: the value in mono, its full text on hover,
// and the network it lives on when the page doesn't already say.
export function EvidenceLink({
  href,
  value,
  shown = value,
  network,
}: {
  href: string;
  value: string;
  shown?: string;
  network?: "devnet" | "mainnet";
}) {
  return (
    <>
      <a className="evidence" href={href} title={value} rel="noopener noreferrer">
        <span className="mono">{shown}</span>
        <span className="out" aria-hidden="true">
          ↗
        </span>
      </a>
      {network && (
        <>
          {" "}
          <span className="net">{network}</span>
        </>
      )}
    </>
  );
}

// A landing-page section: its heading, one line on what it shows, then the content.
export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="frame" aria-labelledby={`${id}-title`}>
      <div className="wrap">
        <header className="frame-head">
          <h2 id={`${id}-title`}>{title}</h2>
          {lead && <p>{lead}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

// An audit page's framed block, such as an epoch's settlement.
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
