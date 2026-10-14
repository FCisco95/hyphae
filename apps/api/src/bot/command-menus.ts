import type { BotCommand, BotCommandScope } from "grammy/types";

// /me, /setup, /link and /rules only point back to the group when sent privately, so the private
// menu leaves them out.
export const PRIVATE_COMMANDS: BotCommand[] = [
  { command: "start", description: "Open Hyphae" },
  { command: "notifications", description: "Your private raid alerts" },
  { command: "receipt", description: "Read a submission receipt" },
  { command: "issue", description: "Report a scoring issue" },
];
export const GROUP_COMMANDS: BotCommand[] = [
  { command: "help", description: "How raids and scoring work" },
  { command: "me", description: "Your private checklist" },
  { command: "setup", description: "Get set up to be paid" },
  { command: "link", description: "Link your wallet" },
  { command: "rules", description: "Take the rules test" },
  { command: "notifications", description: "Private raid alerts" },
];
export const ADMIN_COMMANDS: BotCommand[] = [
  ...GROUP_COMMANDS,
  { command: "raid", description: "Open a raid on an X post" },
  { command: "raids", description: "Open raids, with Close buttons" },
  { command: "close_raid", description: "Close a raid" },
  { command: "cancel_raid", description: "Cancel a raid" },
];

export interface CommandMenuApi {
  setMyCommands(
    commands: readonly BotCommand[],
    other: { scope: BotCommandScope },
  ): Promise<unknown>;
}

// Best effort: a menu that fails to set is reported, never fatal.
export async function registerCommandMenus(
  api: CommandMenuApi,
  admins: { chatId: bigint; adminId: bigint }[],
): Promise<string[]> {
  const results: string[] = [];
  const set = async (label: string, commands: BotCommand[], scope: BotCommandScope) => {
    try {
      await api.setMyCommands(commands, { scope });
      results.push(`${label}:ok`);
    } catch {
      results.push(`${label}:failed`);
    }
  };
  await set("private", PRIVATE_COMMANDS, { type: "all_private_chats" });
  await set("groups", GROUP_COMMANDS, { type: "all_group_chats" });
  for (const a of admins)
    await set(`admin ${a.chatId}`, ADMIN_COMMANDS, {
      type: "chat_member",
      chat_id: Number(a.chatId),
      user_id: Number(a.adminId),
    });
  return results;
}
