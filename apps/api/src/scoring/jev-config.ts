import type { JevDeps } from "../rewards/evaluation.js";
import { jevTransport } from "./jev-client.js";
import type { JevRegistry } from "./scorers.js";

// Jev scoring is off unless the operator turns it on; off leaves every code path as it was.
// Misconfiguration throws here, at boot, so the worker never starts half-enabled.
export function jevDepsFromEnv(
  cfg: { JEV_SCORING?: string | undefined; TYPESAFE_API_KEY?: string | undefined },
  registry: JevRegistry,
): JevDeps | undefined {
  if (cfg.JEV_SCORING !== "on") return undefined;
  if (registry.size === 0)
    throw new Error("scoring: JEV_SCORING is on but no Jev scorer is registered");
  return { registry, transport: jevTransport({ apiKey: cfg.TYPESAFE_API_KEY ?? "" }) };
}
