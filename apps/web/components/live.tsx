"use client";

import type { CommunityStatsV1, CommunityV1 } from "@hyphae/core";
import { useEffect, useState } from "react";
import { PHASES, phaseOf, remaining } from "../lib/epoch-phase.js";
import { utc } from "../lib/format.js";

// Live time for the community page. The first render, on the server and in the browser alike, is
// computed from the read's own `as_of`, so the two agree; the browser's clock takes over once the
// page is mounted. A page that never runs this script still shows the UTC times.

function useNow(asOf: string): { now: number; live: boolean } {
  const [now, setNow] = useState(() => Date.parse(asOf));
  const [live, setLive] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    setLive(true);
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return { now, live };
}

export function Countdown({ to, asOf, label }: { to: string; asOf: string; label: string }) {
  const { now, live } = useNow(asOf);
  const left = Date.parse(to) - now;
  return (
    <p className="countdown">
      <span className="countdown-label">{label}</span>{" "}
      <time dateTime={to} title={utc(to)}>
        {live ? (left > 0 ? `in ${remaining(left)}` : "now") : utc(to)}
      </time>
    </p>
  );
}

type Epoch = CommunityV1["epochs"][number];

export function EpochClock({
  epoch,
  payouts,
  raidEnd,
  asOf,
}: {
  epoch: Epoch;
  payouts?: CommunityStatsV1["payouts"];
  // When the open raid that ends first closes, if any.
  raidEnd?: string | null;
  asOf: string;
}) {
  const { now, live } = useNow(asOf);
  const phase = phaseOf(epoch, now, payouts);
  const current = PHASES[phase.step];
  const headline =
    phase.step < 0
      ? `Epoch ${phase.epoch} opens soon`
      : current
        ? `Epoch ${phase.epoch}: ${current.label.toLowerCase()}`
        : `Epoch ${phase.epoch} is fully claimed`;
  return (
    <section className="epoch-clock" aria-labelledby="epoch-clock-title">
      <div>
        <p className="eyebrow">Epoch clock</p>
        <h2 id="epoch-clock-title">{headline}</h2>
        {phase.until !== null ? (
          <p className="countdown">
            <span className="countdown-label">
              {phase.step < 0 ? "Opens" : phase.step === 0 ? "Closes" : "Checks end"}
            </span>{" "}
            <time dateTime={new Date(phase.until).toISOString()}>
              {live
                ? `in ${remaining(phase.until - now)}`
                : utc(new Date(phase.until).toISOString())}
            </time>
          </p>
        ) : null}
        {raidEnd ? <Countdown to={raidEnd} asOf={asOf} label="Next raid ends" /> : null}
        <p className="small muted">
          {phase.note ?? current?.hint ?? "Every allocated lamport has been claimed."}
        </p>
      </div>
      <ol className="phase-stepper" aria-label={`Epoch ${phase.epoch} phases`}>
        {PHASES.map((p, i) => (
          <li
            key={p.key}
            data-state={i < phase.step ? "done" : i === phase.step ? "current" : "next"}
            aria-current={i === phase.step ? "step" : undefined}
          >
            <span className="phase-dot" aria-hidden="true" />
            <span className="phase-label">{p.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
