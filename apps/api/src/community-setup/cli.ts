import { open } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseSetupManifest, SetupError, type SetupManifest, setupPlan } from "./manifest.js";

export const SETUP_USAGE =
  "community-setup plan|check|apply --manifest <private.json> [--environment disposable|production] [--approve <plan sha256>]";

export function parseSetupArgs(argv: string[]) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        manifest: { type: "string" },
        environment: { type: "string" },
        approve: { type: "string" },
      },
    });
    const command = positionals[0];
    if (
      positionals.length !== 1 ||
      !["plan", "check", "apply"].includes(command ?? "") ||
      !values.manifest
    )
      throw new Error();
    if (command === "plan") {
      if (values.environment || values.approve) throw new Error();
    } else if (!["disposable", "production"].includes(values.environment ?? "")) throw new Error();
    if (command === "apply" ? !/^[a-f0-9]{64}$/.test(values.approve ?? "") : !!values.approve)
      throw new Error();
    return {
      command: command as "plan" | "check" | "apply",
      path: values.manifest,
      environment: values.environment,
      approvedHash: values.approve,
    };
  } catch {
    throw new SetupError("invalid_arguments");
  }
}

export async function readSetupManifest(path: string) {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(path, "r");
    const buffer = Buffer.alloc(65_537);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await file.read(buffer, count, buffer.length - count, count);
      if (!bytesRead) break;
      count += bytesRead;
    }
    if (count > 65_536) throw new Error();
    return parseSetupManifest(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, count))),
    );
  } catch {
    throw new SetupError("invalid_manifest");
  } finally {
    await file?.close();
  }
}

export function verifyDatabaseTarget(url: string, m: SetupManifest): void {
  try {
    const target = new URL(url);
    const query = [...target.searchParams];
    if (
      !["postgres:", "postgresql:"].includes(target.protocol) ||
      target.hostname !== m.database.host ||
      Number(target.port || 5432) !== m.database.port ||
      decodeURIComponent(target.pathname.slice(1)) !== m.database.name ||
      target.hash
    )
      throw new Error();
    // postgres-js accepts connection overrides in query parameters. Keep the target bound
    // to the reviewed host/port/database; only an explicit TLS mode is allowed.
    if (
      query.length > 1 ||
      query.some(([key, value]) => key !== "sslmode" || !["require", "verify-full"].includes(value))
    )
      throw new Error();
    if (m.environment === "disposable" && !["127.0.0.1", "localhost"].includes(target.hostname))
      throw new Error();
  } catch {
    throw new SetupError("environment_mismatch");
  }
}

export async function runSetupCli(
  argv: string[],
  deps: {
    read: (path: string) => Promise<SetupManifest>;
    execute: (
      command: "check" | "apply",
      manifest: SetupManifest,
      hash?: string,
    ) => Promise<unknown>;
  },
) {
  const args = parseSetupArgs(argv);
  const m = parseSetupManifest(await deps.read(args.path));
  if (args.command === "plan") return setupPlan(m);
  if (args.environment !== m.environment) throw new SetupError("environment_mismatch");
  if (args.command === "apply" && args.approvedHash !== setupPlan(m).hash)
    throw new SetupError("plan_mismatch");
  return deps.execute(args.command, m, args.approvedHash);
}
