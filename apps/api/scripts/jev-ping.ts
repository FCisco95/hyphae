// Usage: node --env-file=<abs .env> --import tsx scripts/jev-ping.ts
// One tiny paid Jev call (about USD 0.00001) through the same client the worker uses: proves the
// key, the pinned model and the SDK work from this machine. It reads no member data and writes
// nothing. Run it with TYPESAFE_API_KEY set, before turning JEV_SCORING on.
import { noul } from "@typesafe-ai/sdk";
import { jevTransport } from "../src/scoring/jev-client.js";

const MODEL = "jev-1.13.0";
const send = jevTransport({ apiKey: process.env.TYPESAFE_API_KEY ?? "" });
const { response, latencyMs } = await send({
  model: MODEL,
  state: { text: "The sky is blue on a clear day." },
  questions: { sky_is_blue: noul("Does `text` say the sky is blue?") },
});
const answered = (response as { model?: string }).model;
if (answered !== MODEL) throw new Error(`answered by ${answered}, pinned ${MODEL}`);
console.log(JSON.stringify({ latencyMs, response }, null, 2));
process.exit(0);
