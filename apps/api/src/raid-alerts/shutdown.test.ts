import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe.skipIf(process.platform === "win32")("real API process shutdown signals", () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    it(`drains the notifier then exits with ${signal} despite active HTTP/queue-like handles`, async () => {
      const moduleUrl = pathToFileURL(`${process.cwd()}/src/raid-alerts/shutdown.ts`).href;
      const source = `import {stopApiOnSignals} from ${JSON.stringify(moduleUrl)};
        setInterval(()=>{},1000);
        stopApiOnSignals(async()=>{console.log('draining');await new Promise(r=>setTimeout(r,30));console.log('drained')});
        console.log('ready');`;
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", source],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "";
      let signalled = false;
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        if (!signalled && output.includes("ready")) {
          signalled = true;
          child.kill(signal);
        }
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 3000);
      try {
        const result = await new Promise<{ code: number | null; signal: string | null }>(
          (resolve, reject) => {
            child.once("error", reject);
            child.once("exit", (code, stoppedBy) => resolve({ code, signal: stoppedBy }));
          },
        );
        expect(output).toContain("drained");
        expect(result).toEqual({ code: 0, signal: null });
      } finally {
        clearTimeout(timer);
        child.kill("SIGKILL");
      }
    });
  }
});
