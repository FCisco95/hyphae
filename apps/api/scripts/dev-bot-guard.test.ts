import { describe, expect, it } from "vitest";
import { checkDevBotEnv, refuseWebhookBot } from "./dev-bot-guard.js";

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
      databaseUrl: "postgres://postgres:dev@127.0.0.1:55433/hyphae",
    });
  });

  it("hands back a rebuilt canonical database url", () => {
    const urlFor = (DATABASE_URL: string) => {
      const checked = checkDevBotEnv({ ...dev, DATABASE_URL }, production);
      return checked.ok ? checked.databaseUrl : checked;
    };
    expect(urlFor("postgresql://postgres:dev@localhost:55433/hyphae")).toBe(
      "postgres://postgres:dev@localhost:55433/hyphae",
    );
    expect(urlFor("postgres://postgres:p%40ss@127.0.0.1/hyphae")).toBe(
      "postgres://postgres:p%40ss@127.0.0.1/hyphae",
    );
    expect(urlFor("postgres://postgres@127.0.0.1:5432/hyphae")).toBe(
      "postgres://postgres@127.0.0.1:5432/hyphae",
    );
  });

  it("refuses a url the database drivers would read differently", () => {
    for (const DATABASE_URL of [
      "postgres://u:p@127.0.0.1:55433/hyphae?host=remote.invalid",
      "postgres://u:p@127.0.0.1:55433/hyphae?",
      "postgres://u:p@127.0.0.1:55433/hyphae?sslmode=require",
      "postgres://u:p@127.0.0.1#,remote.invalid/hyphae",
      "postgres://u:p@127.0.0.1:55433/hyphae#remote.invalid",
      "postgres://u:p@127.0.0.1,remote.invalid/hyphae",
      "postgres://u:p@127.0.0.1:55433,remote.invalid:5432/hyphae",
      "postgres://u:p@127.0.0.1:55433/hyphae ",
      "postgres://u:p@127.0.0.1:55433/hy phae",
      "postgres://u:p@127.0.0.1\t:55433/hyphae",
      "postgres://u@127.0.0.1@remote.invalid/hyphae",
      "http://u:p@127.0.0.1:55433/hyphae",
      "postgres://u:p@127.0.0.1:55433",
      "postgres://u:p@127.0.0.1:55433/",
      "postgres://u:p@127.0.0.1:55433/hyphae/extra",
    ])
      expect(checkDevBotEnv({ ...dev, DATABASE_URL }, production), DATABASE_URL).toMatchObject({
        ok: false,
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

  it("refuses the production bot by its public id when the root .env is missing or stale", () => {
    const refused = {
      ok: false,
      reason: "that is the production bot; use the test bot's token",
    };
    const token = `8927990203:${"D".repeat(35)}`;
    expect(checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: token }, {})).toEqual(refused);
    expect(checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: token }, production)).toEqual(refused);
  });

  it("refuses a missing token or malformed ids", () => {
    expect(checkDevBotEnv({ ...dev, TELEGRAM_BOT_TOKEN: undefined }, production)).toMatchObject({
      ok: false,
    });
    expect(checkDevBotEnv({ ...dev, DEV_CHAT_ID: "123" }, production)).toMatchObject({ ok: false });
    expect(checkDevBotEnv({ ...dev, DEV_ADMIN_ID: "-5" }, production)).toMatchObject({ ok: false });
  });
});

describe("dev-bot webhook guard", () => {
  it("lets a bot with no webhook through", () => {
    expect(refuseWebhookBot({ url: "" })).toBeNull();
  });

  it("refuses a bot that has a webhook, because only a deployed bot has one", () => {
    expect(refuseWebhookBot({ url: "https://hyphae-api.fly.dev/telegram/webhook" })).toEqual(
      expect.stringContaining("webhook"),
    );
    expect(refuseWebhookBot({ url: "x" })).not.toBeNull();
  });

  it("fails closed when Telegram answers without a url", () => {
    expect(refuseWebhookBot({})).not.toBeNull();
  });
});
