import { readFileSync } from "node:fs";
import { promptTemplateHash, RubricSchema, type ScoringInput } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_MODEL,
  claudeCostMicroUsd,
  claudeRequest,
  claudeRequestHash,
  claudeTemplateHash,
} from "./claude-questions.js";
import { CLAUDE_REGISTRY } from "./claude-registry.js";
import { QUESTIONS_V4 } from "./jev-questions.js";
import { JEV_REGISTRY } from "./jev-registry.js";
import { pinHash, routeFor } from "./scorers.js";

const rubric = RubricSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../../docs/rubrics/mycel-1.3.0.json", import.meta.url), "utf8"),
  ),
);
const input: ScoringInput = {
  rubric,
  task: {
    targetUrl: "https://x.com/a/status/1",
    targetAuthor: "a",
    targetText: "Post.",
    brief: "",
  },
  contribution: { kind: "reply", text: "which rubric line did i miss?" },
};

const def = CLAUDE_REGISTRY.get("reward-eval/3");
if (!def) throw new Error("reward-eval/3 is not registered");

describe("the Claude question registry", () => {
  it("registers Haiku 5.5 answering question set v4 as reward-eval/3, and nothing else", () => {
    expect([...CLAUDE_REGISTRY.keys()]).toEqual(["reward-eval/3"]);
    expect(def.model).toBe("anthropic:claude-haiku-5-5");
    expect(def.model).toBe(`anthropic:${CLAUDE_MODEL}`);
  });

  it("keeps effort judgments on the Anthropic effort prompt", () => {
    expect(def.effortVersion).toBe("reward-eval/2");
    expect(routeFor("reward-eval/3", "quality", CLAUDE_REGISTRY)).toEqual({ kind: "jev", def });
    for (const purpose of ["quality_effort", "effort"] as const) {
      expect(routeFor("reward-eval/3", purpose, CLAUDE_REGISTRY)).toEqual({
        kind: "prompt",
        version: "reward-eval/2",
      });
    }
  });

  // The pin. A change to the model, a request setting, the prompt text or any question or weight
  // must change this on purpose.
  it("pins the model, the prompt text and every v4 question and weight", () => {
    expect(def.templateHash).toBe(claudeTemplateHash(QUESTIONS_V4));
    expect(def.templateHash).toBe(
      "48dabec502358a3a2a26365d6a8c19a27d8505055f4c49aecb989864890b047d",
    );
  });

  it("is a version of its own: no prompt version or Jev scorer shares its name or pin", () => {
    expect(promptTemplateHash("reward-eval/3")).toBeNull();
    expect(pinHash("reward-eval/3", CLAUDE_REGISTRY)).toBe(def.templateHash);
    expect(pinHash("reward-eval/3")).toBeNull();
    expect(JEV_REGISTRY.has("reward-eval/3")).toBe(false);
    expect([...JEV_REGISTRY.values()].map((d) => d.templateHash)).not.toContain(def.templateHash);
  });

  it("commits the exact request before the call", () => {
    const { body, hash } = def.request(input);
    expect(body).toEqual(claudeRequest(input, QUESTIONS_V4));
    expect(hash).toBe(claudeRequestHash(claudeRequest(input, QUESTIONS_V4)));
  });

  it("prices a paid response that failed later checks at the Haiku rate", () => {
    expect(def.costOf).toBe(claudeCostMicroUsd);
  });

  it("composes one call into a score with its evidence", async () => {
    let sent: unknown;
    const yes = ["asks_question"];
    const score = await def.run(input, async (request) => {
      sent = request;
      return {
        response: {
          id: "msg_01",
          type: "message",
          role: "assistant",
          model: CLAUDE_MODEL,
          content: [
            {
              type: "text",
              text: JSON.stringify(
                Object.fromEntries(
                  [
                    ...Object.keys(QUESTIONS_V4.gates),
                    "ai_slop",
                    "ai_slop_obvious",
                    "polished",
                    ...Object.keys(QUESTIONS_V4.bonuses),
                  ].map((id) => [id, yes.includes(id)]),
                ),
              ),
            },
          ],
          stop_reason: "end_turn",
          stop_details: null,
          usage: { input_tokens: 5200, output_tokens: 700 },
        },
        latencyMs: 1500,
        mode: "live",
      };
    });
    expect(sent).toEqual(def.request(input).body);
    expect(score.output.score).toBe(75);
    expect(score.requestHash).toBe(def.request(input).hash);
    expect(score.latencyMs).toBe(1500);
    expect(score.costMicroUsd).toBe(870);
    expect(score.evidence).toMatchObject({
      questionSet: "v4-2026-10-07",
      model: CLAUDE_MODEL,
      messageId: "msg_01",
      rubricVersion: rubric.version,
      composition: { version: "2", base: 65, bonus: 10 },
      usage: { input_tokens: 5200, output_tokens: 700 },
    });
    expect((score.evidence.answers as Record<string, boolean>).asks_question).toBe(true);
    expect(score.evidence.configurationHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
