import type { BotCommand, BotCommandScope } from "grammy/types";
import { describe, expect, it } from "vitest";
import {
  ADMIN_COMMANDS,
  GROUP_COMMANDS,
  PRIVATE_COMMANDS,
  registerCommandMenus,
} from "./command-menus.js";

describe("command menus", () => {
  it("sets the private, group and per-admin menus and reports a failure without throwing", async () => {
    const calls: { commands: string[]; scope: BotCommandScope }[] = [];
    const api = {
      setMyCommands: async (commands: readonly BotCommand[], other: { scope: BotCommandScope }) => {
        calls.push({ commands: commands.map((c) => c.command), scope: other.scope });
        if (other.scope.type === "chat_member" && other.scope.chat_id === -1002)
          throw new Error("chat not found");
        return true;
      },
    };
    expect(
      await registerCommandMenus(api, [
        { chatId: -1001n, adminId: 7n },
        { chatId: -1002n, adminId: 8n },
      ]),
    ).toEqual(["private:ok", "groups:ok", "admin -1001:ok", "admin -1002:failed"]);
    expect(calls.slice(0, 3)).toEqual([
      {
        commands: ["start", "notifications", "receipt", "issue"],
        scope: { type: "all_private_chats" },
      },
      {
        commands: ["help", "me", "setup", "link", "rules", "notifications"],
        scope: { type: "all_group_chats" },
      },
      {
        commands: [
          "help",
          "me",
          "setup",
          "link",
          "rules",
          "notifications",
          "raid",
          "raids",
          "close_raid",
          "cancel_raid",
        ],
        scope: { type: "chat_member", chat_id: -1001, user_id: 7 },
      },
    ]);
  });

  it("uses names and descriptions Telegram accepts", () => {
    for (const c of [...PRIVATE_COMMANDS, ...GROUP_COMMANDS, ...ADMIN_COMMANDS]) {
      expect(c.command).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.description.length).toBeLessThanOrEqual(256);
    }
  });
});
