import { RUBRIC_1_2_0, RUBRIC_1_3_0 } from "../lib/links.js";
import {
  EXAMPLES,
  exampleGroup,
  type GradedExample,
  type RulesStatus,
  type Version,
} from "../lib/rules.js";
import { Panel } from "./ui.js";

// Both rubrics. Every line is what the code enforces today; the rubric text's strikes are not
// built, so they are not here.
const BASICS: string[] = [
  "Reply to the raid's post: react to something specific in it and add an angle (an insight, a question, a comparison, a joke that lands, a technical note), in your own words.",
  "One reply and one quote per raid count.",
  "Full credit for 6 hours after a raid opens, then it falls to 0 at 48 hours.",
  "An AI grades every contribution against the rubric and shows its reasoning. Below 60/100 earns nothing. A reply that reads like an unedited AI draft is capped at 79, or at 40 when it is obvious.",
  "0 whatever the effort: hype that fits under any post (“lfg”, “gm”, “great project ser”), emoji only, a copy of another member's reply or your own, anything off-topic or promoting something else.",
  "The community admin can correct any grade, and corrections are public.",
];

const PRICE_1_2_0 =
  "About MYCEL or any specific coin, never: tell anyone to buy, ape, get in or hold it; say where its price is going or name targets, even with reasons; promise gains or claim returns. Each earns 0, whatever the effort. General market talk is opinion and allowed (“holding usually beats trading”).";

const CHANGES_1_3_0: string[] = [
  "Price talk about a specific coin is allowed when it gives a concrete basis (the post's own numbers are enough) and is framed as uncertain. “Could” or “NFA” does not turn a bare target into reasoning.",
  "Still 0 whatever the effort: telling anyone to buy, ape, get in or hold a coin; promising gains, guaranteed returns or a certain price; unsupported price hype.",
  "You may say you hold a coin. That is not telling anyone to buy, and on its own it earns nothing.",
  "Criticism with substance has the same chance as praise. There is no bonus for views, likes, followers or repeated coin mentions.",
  "Disclose a reward relationship where it applies. An honest disclosure does not lower your grade.",
];

const NEW_TEST =
  "Rubric 1.3.0 has its own rules test: a pass of the rubric 1.2.0 test does not count for epochs under 1.3.0.";

// 1.3.0 is planned for epoch 4 (ruled 2026-09-29) through an O4 proposal the page cannot read. It
// names that epoch only while it is still ahead, and never asserts when 1.3.0 took effect.
const PLANNED_EPOCH = 4;

function title(v: Version, status: RulesStatus): string {
  if (status.state !== "known") return `Rubric ${v}`;
  if (status.now === v) return `The rules now: rubric ${v}`;
  if (v === "1.2.0") return `Earlier rules: rubric ${v}`;
  return status.epoch < PLANNED_EPOCH
    ? `Planned for epoch ${PLANNED_EPOCH}: rubric ${v}`
    : `Planned: rubric ${v}`;
}

// When 1.3.0 is not read as in force: planned while 1.2.0 is read as now, and otherwise a
// sentence true whether or not it has taken effect.
function plan(status: RulesStatus): string {
  if (status.state !== "known") {
    return `Rubric 1.3.0 replaces 1.2.0 from the epoch its proposal activates; the plan is epoch ${PLANNED_EPOCH}, from 2026-10-16.`;
  }
  return status.epoch < PLANNED_EPOCH
    ? `Planned for epoch ${PLANNED_EPOCH}, from 2026-10-16, once the change is proposed and accepted.`
    : "Planned, and not in force yet.";
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const Source = ({ href, version }: { href: string; version: Version }) => (
  <p className="muted">
    The full text:{" "}
    <a href={href} rel="noopener noreferrer">
      rubric {version}
    </a>
    .
  </p>
);

// The rules of one rubric, complete when they apply now (or when that cannot be read), and as
// the difference from the other rubric otherwise.
function RubricSection({ version, status }: { version: Version; status: RulesStatus }) {
  const now = status.state === "known" ? status.now : "1.2.0";
  if (version === "1.2.0") {
    return (
      <Panel title={title(version, status)}>
        {now === "1.2.0" ? (
          <Bullets items={[...BASICS, PRICE_1_2_0]} />
        ) : (
          <>
            <p>What was different from rubric 1.3.0:</p>
            <Bullets items={[PRICE_1_2_0]} />
          </>
        )}
        <Source href={RUBRIC_1_2_0} version={version} />
      </Panel>
    );
  }
  return (
    <Panel title={title(version, status)}>
      {now === "1.3.0" ? (
        <Bullets items={[...BASICS, ...CHANGES_1_3_0]} />
      ) : (
        <>
          <p>{plan(status)} Each epoch keeps the rubric it opened with. What changes:</p>
          <Bullets items={CHANGES_1_3_0} />
          <p>Everything else stays as above.</p>
        </>
      )}
      <p>{NEW_TEST}</p>
      <Source href={RUBRIC_1_3_0} version={version} />
    </Panel>
  );
}

function StatusLine({ status }: { status: RulesStatus }) {
  if (status.state === "known") {
    return (
      <p className="banner">
        Epoch {status.epoch} is open now and scored under rubric {status.now}.
      </p>
    );
  }
  return (
    <div className="notice">
      <p>
        {status.state === "other"
          ? `Epoch ${status.epoch} is scored under rubric ${status.version}, which this page does not cover yet.`
          : "Could not read which rubric the open epoch uses right now."}{" "}
        Each epoch's page on the community page shows its rubric.
      </p>
    </div>
  );
}

const range = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

function Example({ e, show120 }: { e: GradedExample; show120: boolean }) {
  return (
    <article className="panel">
      <p className="eyebrow">Post</p>
      <blockquote className="example-post">{e.post}</blockquote>
      {e.note && <p className="muted">{e.note}</p>}
      <p className="eyebrow">Reply</p>
      <blockquote>{e.reply}</blockquote>
      <p>
        <strong>
          {`Founder's grade ${range(e.grade)} · credited ${range(e.credited)}${e.reason ? `: ${e.reason}` : ""}`}
        </strong>
      </p>
      <p>{e.why}</p>
      {show120 && e.under120 && <p className="banner">{e.under120}</p>}
    </article>
  );
}

const GROUPS = [
  ["earns", "Earns points"],
  ["nothing", "Earns nothing"],
  ["never", "Always 0: breaks the rules, off-topic or spam"],
] as const;

export function RulesView({ status }: { status: RulesStatus }) {
  const order: Version[] =
    status.state === "known" && status.now === "1.3.0" ? ["1.3.0", "1.2.0"] : ["1.2.0", "1.3.0"];
  const show120 = !(status.state === "known" && status.now === "1.3.0");
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">MYCEL</p>
        <h1>The rules</h1>
        <p className="muted">
          How a reply to a raid is graded, with sixteen sample replies the founder graded. Then take
          the rules test: send /rules in the community chat. A pass is one of the conditions for
          being paid for an epoch.
        </p>
      </header>
      <StatusLine status={status} />
      {order.map((v) => (
        <RubricSection key={v} version={v} status={status} />
      ))}
      <h2>Graded examples</h2>
      <p className="muted">
        The founder graded these replies for rubric 1.3.0, to check the AI grader against. The AI
        grades real replies and can differ; the community admin can correct any grade, and
        corrections are public.
      </p>
      {GROUPS.map(([group, heading]) => (
        <section key={group}>
          <h3>{heading}</h3>
          {EXAMPLES.filter((e) => exampleGroup(e) === group).map((e) => (
            <Example key={e.id} e={e} show120={show120} />
          ))}
        </section>
      ))}
    </>
  );
}
