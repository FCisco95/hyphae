import { createHyphaeReadClient, HyphaeReadError } from "@hyphae/read-client";

const communityInput = document.querySelector("#community");
const scenarioInput = document.querySelector("#scenario");
const reload = document.querySelector("#reload");
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
let active;
let generation = 0;
let cooldown;

const value = (key, text) => {
  document.querySelector(`[data-value="${key}"]`).textContent = text;
};
function clearSummary() {
  for (const key of [
    "epoch",
    "intake",
    "contributions",
    "counted",
    "pending",
    "points",
    "allocation",
    "payment",
    "asof",
  ])
    value(key, "Unavailable");
}
const messages = {
  unavailable: "The API is unavailable. The totals below are unknown, not zero.",
  schema_mismatch: "The response could not be validated. No totals or payment claim can be shown.",
  identity_mismatch: "The response belongs to a different community. It has been refused.",
  timeout: "The read deadline was reached. No totals can be confirmed.",
  network_error: "The read could not connect. No totals can be confirmed.",
};

async function load() {
  active?.abort();
  active = new AbortController();
  const version = ++generation;
  const mint = communityInput.value;
  const scenario = scenarioInput.value;
  clearTimeout(cooldown);
  reload.disabled = false;
  clearSummary();
  summary.setAttribute("aria-busy", "true");
  value("name", communityInput.selectedOptions[0].textContent);
  value("mint", mint);
  status.dataset.state = "loading";
  status.textContent = "Reading the selected community…";
  const client = createHyphaeReadClient({
    baseUrl: `${location.origin}/v1`,
    timeoutMs: 750,
    fetch: (input, init) => {
      const url = new URL(input);
      // This query exists only on this disposable fixture server, never the production API.
      url.searchParams.set("fixtureScenario", scenario);
      return fetch(url, init);
    },
  });
  try {
    const options = { signal: active.signal };
    const community = await client.getCommunity(mint, options);
    const epoch =
      community.current_epoch === null
        ? null
        : await client.getEpoch(mint, community.current_epoch, options);
    if (version !== generation) return;
    value("name", community.name);
    value("intake", community.reward_intake);
    value("epoch", epoch ? `${epoch.index} · ${epoch.status}` : "No current epoch");
    value("asof", epoch?.as_of ?? community.as_of);
    if (epoch) {
      value("contributions", String(epoch.counts.contributions));
      value("counted", String(epoch.counts.counted));
      value("pending", String(epoch.counts.pending));
      value("points", epoch.totals.points);
      const settlement = epoch.settlement ?? {
        allocation: epoch.allocation,
        payment: epoch.payment,
      };
      value(
        "allocation",
        settlement.allocation.status === "unavailable"
          ? `Unavailable · ${settlement.allocation.reason}`
          : settlement.allocation.status,
      );
      value(
        "payment",
        settlement.payment.status === "unavailable"
          ? `Unavailable · ${settlement.payment.reason}`
          : settlement.payment.status,
      );
    }
    status.dataset.state = "ready";
    status.textContent =
      "Fixture data validated for this community. Points are separate from payments.";
  } catch (error) {
    if (version !== generation) return;
    const code = error instanceof HyphaeReadError ? error.code : "unavailable";
    status.dataset.state = "error";
    status.textContent =
      code === "rate_limited"
        ? "Rate limited. Wait before deliberately trying again."
        : (messages[code] ?? "This read could not be confirmed.");
    if (code === "rate_limited") {
      reload.disabled = true;
      cooldown = setTimeout(
        () => {
          if (version === generation) reload.disabled = false;
        },
        (error.retryAfterSeconds ?? 1) * 1000,
      );
    }
  } finally {
    if (version === generation) summary.setAttribute("aria-busy", "false");
  }
}

const config = await (await fetch("/demo.json")).json();
for (const community of config.communities) {
  const option = document.createElement("option");
  option.value = community.mint;
  option.textContent = community.name;
  communityInput.append(option);
}
communityInput.addEventListener("change", load);
scenarioInput.addEventListener("change", load);
reload.addEventListener("click", load);
await load();
