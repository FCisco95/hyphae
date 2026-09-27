import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.url(),
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  SCORING_MODEL: z.string().default("anthropic:claude-sonnet-5"),
  PUBLIC_WEB_URL: z.url().default("https://hyphae.fun"),
  PORT: z.coerce.number().default(8080),
  // Origin of the wallet-signing page and proof endpoints; it is part of every signed message.
  LINK_ORIGIN: z.url().refine((v) => new URL(v).protocol === "https:" && new URL(v).origin === v, {
    message: "LINK_ORIGIN must be a bare https origin",
  }),
  LINK_CHAIN: z.enum(["solana:mainnet", "solana:devnet"]).default("solana:mainnet"),
  // Hold gate readers (P16): Helius and an independent non-Helius mainnet provider, keys in the URL.
  // Missing or invalid values hold every candidate instead of failing the process.
  HOLD_RPC_HELIUS_URL: z.string().min(1).optional(),
  HOLD_RPC_FALLBACK_URL: z.string().min(1).optional(),
  // P14's read-only chain reads (epoch accounts, claim receipts). Unset, the settlement sections
  // stay chain_unconfigured. The cluster is proven by its genesis hash on first use.
  READ_RPC_URL: z.url().optional(),
  // Shared with the web server, whose read calls are then limited per visitor, not per address.
  READ_API_WEB_TOKEN: z.string().min(32).optional(),
});

export const env = Env.parse(process.env);
