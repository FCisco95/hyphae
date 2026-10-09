import { z } from "zod";

const ProviderUser = z.object({
  id: z.string(),
  linked_accounts: z.array(z.object({ type: z.string() }).passthrough()),
});
const TelegramAccount = z.object({
  telegram_user_id: z.string().regex(/^[1-9][0-9]{0,15}$/),
});

export function telegramIdentity(user: unknown, subject: string): bigint | null {
  const record = ProviderUser.parse(user);
  if (record.id !== subject) throw new Error("identity_unavailable");
  const links = record.linked_accounts.filter((account) => account.type === "telegram");
  if (links.length === 0) return null;
  if (links.length !== 1) throw new Error("identity_unavailable");
  const id = BigInt(TelegramAccount.parse(links[0]).telegram_user_id);
  if (id > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("identity_unavailable");
  return id;
}
