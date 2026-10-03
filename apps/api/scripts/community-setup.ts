import { createDb } from "@hyphae/db";
import {
  readSetupManifest,
  runSetupCli,
  SETUP_USAGE,
  verifyDatabaseTarget,
} from "../src/community-setup/cli.js";
import { SetupError } from "../src/community-setup/manifest.js";
import { applyCommunitySetup, checkCommunitySetup } from "../src/community-setup/registration.js";
import { setupTelegramReader } from "../src/community-setup/telegram.js";

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--help") {
    console.log(SETUP_USAGE);
    return;
  }
  const result = await runSetupCli(argv, {
    read: readSetupManifest,
    execute: async (command, manifest, hash) => {
      // Deliberately no fallback to ambient DATABASE_URL: setup must name its own connection.
      const url = process.env.COMMUNITY_SETUP_DATABASE_URL;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!url || !token) throw new SetupError("credentials_missing");
      verifyDatabaseTarget(url, manifest);
      const db = createDb(url);
      try {
        const telegram = setupTelegramReader(token);
        return command === "check"
          ? await checkCommunitySetup(db, manifest, telegram)
          : await applyCommunitySetup(db, manifest, hash ?? "", telegram);
      } finally {
        await db.$client.end();
      }
    },
  });
  // Operator-only output. No provider objects, raw exception text or credentials.
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof SetupError ? error.code : "setup_unavailable");
  process.exitCode = 1;
});
