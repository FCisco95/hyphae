import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "@hyphae/db";
import { describe, expect, it, vi } from "vitest";
import { parseSetupArgs, readSetupManifest, runSetupCli, verifyDatabaseTarget } from "./cli.js";
import { parseSetupManifest, setupPlan } from "./manifest.js";
import { manifest } from "./test-fixture.js";

describe("community setup operator CLI", () => {
  it("refuses implicit ports", () => {
    const m = parseSetupManifest({
      ...manifest(),
      database: { host: "127.0.0.1", port: 5432, name: "hyphae" },
    });
    expect(() => verifyDatabaseTarget("postgres://u:private@127.0.0.1/hyphae", m)).toThrow(
      "environment_mismatch",
    );
  });

  it("refuses ambiguous multi-host/user-info parsing", () => {
    const remote = parseSetupManifest({
      ...manifest(),
      environment: "production",
      database: { host: "db.prod.example", port: 5432, name: "hyphae" },
    });
    expect(() =>
      verifyDatabaseTarget(
        "postgres://u@evil.example,x@db.prod.example:5432/hyphae?sslmode=verify-full",
        remote,
      ),
    ).toThrow("environment_mismatch");
  });

  it("pins the driver target instead of allowing ambient PGPORT to choose another port", async () => {
    vi.stubEnv("PGPORT", "55432");
    const m = parseSetupManifest(manifest());
    const url = "postgres://u:private@127.0.0.1:55433/hyphae";
    const db = createDb(url, verifyDatabaseTarget(url, m));
    try {
      expect(db.$client.options.host).toEqual(["127.0.0.1"]);
      expect(db.$client.options.port).toEqual([55433]);
      expect(db.$client.options.database).toBe("hyphae");
    } finally {
      await db.$client.end();
      vi.unstubAllEnvs();
    }
  });

  it("requires verified TLS for a remote production database", () => {
    const m = parseSetupManifest({
      ...manifest(),
      environment: "production",
      database: { host: "db.prod.example", port: 5432, name: "hyphae" },
    });
    for (const suffix of ["", "?sslmode=require"]) {
      expect(() =>
        verifyDatabaseTarget(`postgres://u:private@db.prod.example:5432/hyphae${suffix}`, m),
      ).toThrow("environment_mismatch");
    }
    expect(() =>
      verifyDatabaseTarget(
        "postgres://u:private@db.prod.example:5432/hyphae?sslmode=verify-full",
        m,
      ),
    ).not.toThrow();
  });
  it("plans offline without invoking credentials, Telegram or a database", async () => {
    const m = parseSetupManifest(manifest());
    const execute = vi.fn();
    const plan = await runSetupCli(["plan", "--manifest", "private.json"], {
      read: async () => m,
      execute,
    });
    expect(plan).toEqual(setupPlan(m));
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(
    [
      [],
      ["apply", "--manifest", "private.json"],
      ["apply", "--manifest", "private.json", "--environment", "production"],
      ["check", "--manifest", "private.json"],
      ["plan", "--manifest", "private.json", "--environment", "production"],
      ["plan", "--manifest", "private.json", "--approve", "0".repeat(64)],
      ["plan", "--manifest", "private.json", "extra"],
      ["plan", "--manifest", "private.json", "--force"],
    ].map((argv) => ({ argv })),
  )("requires explicit, valid commands and rejects bypass flags: %j", ({ argv }) => {
    expect(() => parseSetupArgs(argv)).toThrow("invalid_arguments");
  });

  it("refuses a different environment or unreviewed hash before connecting", async () => {
    const m = parseSetupManifest(manifest());
    const execute = vi.fn();
    for (const [environment, hash, code] of [
      ["production", setupPlan(m).hash, "environment_mismatch"],
      ["disposable", "0".repeat(64), "plan_mismatch"],
    ]) {
      await expect(
        runSetupCli(
          [
            "apply",
            "--manifest",
            "private.json",
            "--environment",
            environment as string,
            "--approve",
            hash as string,
          ],
          { read: async () => m, execute },
        ),
      ).rejects.toThrow(code);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("binds the configured database host, port and database and refuses remote disposable targets", () => {
    const m = parseSetupManifest(manifest());
    expect(() =>
      verifyDatabaseTarget("postgres://u:private@127.0.0.1:55433/hyphae", m),
    ).not.toThrow();
    for (const url of [
      "postgres://u:private@remote.example:55433/hyphae",
      "postgres://u:private@127.0.0.1:55432/hyphae",
      "postgres://u:private@127.0.0.1:55433/production",
      "https://127.0.0.1:55433/hyphae",
      "invalid-secret-url",
      "postgres://u:private@127.0.0.1:55433/hyphae?host=remote.example",
      "postgres://u:private@127.0.0.1:55433/hyphae?database=production",
      "postgres://u:private@127.0.0.1:55433/hyphae?sslmode=disable",
    ])
      expect(() => verifyDatabaseTarget(url, m)).toThrow(/^environment_mismatch$/);
    const remote = parseSetupManifest({
      ...manifest(),
      database: { ...m.database, host: "remote.example" },
    });
    expect(() =>
      verifyDatabaseTarget("postgres://u:private@remote.example:55433/hyphae", remote),
    ).toThrow("environment_mismatch");
  });

  it("bounds and validates private files without echoing their contents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hyphae-setup-test-"));
    const file = join(dir, "manifest.json");
    try {
      await writeFile(file, JSON.stringify(manifest()));
      expect(await readSetupManifest(file)).toEqual(parseSetupManifest(manifest()));
      for (const data of ["private malformed secret", " ".repeat(65_537), Buffer.from([0xff])]) {
        await writeFile(file, data);
        await expect(readSetupManifest(file)).rejects.toThrow(/^invalid_manifest$/);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
