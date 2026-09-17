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
});

export const env = Env.parse(process.env);
