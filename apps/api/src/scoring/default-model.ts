import { env } from "../env.js";
import { scoringModel } from "./provider.js";

export const defaultModel = scoringModel(env.SCORING_MODEL, {
  anthropic: env.ANTHROPIC_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});
