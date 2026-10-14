import { describe, expect, it } from "vitest";
import { checkDevBotEnv } from "./dev-bot-guard.js";

const TEST_TOKEN = `111111:${"A".repeat(35)}`;
const PROD_TOKEN = `222222:${"B".repeat(35)}`;
const dev = {
  TELEGRAM_BOT_TOKEN: TEST_TOKEN,
  DATABASE_URL: "postgres://postgres:dev@127.0.0.1:55433/hyphae",
  DEV_CHAT_ID: "-1001234567890",
  DEV_ADMIN_ID: "123456789",
};
const production = {
  TELEGRAM_BOT_TOKEN: PROD_TOKEN,
  DATABASE_URL: "postgresql://u:p@ep-example-pooler.eu-central-1.aws.neon.tech/neondb",
};

describe("dev-bot guard", () => {
  it("accepts a local database and a test bot", () => {
    expect(checkDevBotEnv(dev, production)).toEqual({
      ok: true,
      chatId: -1001234567890n,
      adminId: 123456789n,
    });
  });

  it("refuses any database that is not on this machine", () => {
    for (const DATABASE_URL of [
      production.DATABASE_URL,
      "postgres://x@10.0.0.5/db",
      "",
      "not a url",
    ])
      expect(checkDevBotEnv({ ...dev, DATABASE_URL }, production)).toMatchObject({ ok: false });
  });

  it("refuses the production bot, by token or by bot id", () => {
    expect(checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: PROD_TOKEN }, production)).toMatchObject({
      ok: false,
    });
    expect(
      checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: `222222:${"C".repeat(35)}` }, production),
    ).toMatchObject({ ok: false });
  });

  it("refuses a missing token or malformed ids", () => {
    expect(checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: undefined }, production)).toMatchObject({
      ok: false,
    });
    expect(checkDevBotEnv({ ...dev, DEV_CHAT_ID: "123" }, production)).toMatchObject({ ok: false });
    expect(checkDevBotEnv({ ...dev, DEV_ADMIN_ID: "-5" }, production)).toMatchObject({ ok: false });
  });
});
