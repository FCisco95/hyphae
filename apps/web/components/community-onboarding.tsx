"use client";

import { getImageProps } from "next/image.js";
import { useState } from "react";
import { COMMUNITY_SETUP_PROMPT } from "../lib/community-onboarding.js";
import { COMMUNITY_SETUP } from "../lib/links.js";

const AGENT_LOGOS = [
  { name: "Cursor", src: "/brand/agents/cursor.svg", size: 18 },
  { name: "Claude Code", src: "/brand/agents/claude-code.svg", size: 18 },
  { name: "OpenAI", src: "/brand/agents/openai.svg", size: 32 },
];

export function CommunityOnboarding() {
  const [dismissed, setDismissed] = useState(false);
  const [copyState, setCopyState] = useState<"ready" | "copied" | "manual">("ready");
  const [expanded, setExpanded] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(COMMUNITY_SETUP_PROMPT);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
      setExpanded(true);
    }
  }

  if (dismissed) return null;

  return (
    <aside className="wrap onboarding-wrap" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <button
          type="button"
          className="onboarding-dismiss"
          aria-label="Dismiss community onboarding"
          onClick={() => setDismissed(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="onboarding-intro">
          <h2 id="onboarding-title">Onboard your community</h2>
          <p>Give your agent the setup guide for your token and Telegram group.</p>
          <a className="onboarding-guide" href={COMMUNITY_SETUP}>
            Operator-assisted setup today
          </a>
        </div>
        <div className="onboarding-action">
          <button type="button" className="onboarding-copy" onClick={copyPrompt}>
            <span className="onboarding-agents" aria-hidden="true">
              {AGENT_LOGOS.map(({ name, src, size }) => (
                <span className="onboarding-agent" title={name} key={name}>
                  {/* biome-ignore lint/performance/noImgElement: getImageProps serves tiny, unmodified local SVGs. */}
                  <img
                    {...getImageProps({
                      src,
                      width: size,
                      height: size,
                      alt: "",
                      unoptimized: true,
                    }).props}
                  />
                </span>
              ))}
            </span>
            <span>{copyState === "copied" ? "Prompt copied" : "Copy setup prompt"}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" />
              <path
                d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"
                stroke="currentColor"
              />
            </svg>
          </button>
          <p className="onboarding-feedback" role="status">
            {copyState === "copied"
              ? "Paste it into your agent to prepare setup."
              : copyState === "manual"
                ? "Copy was blocked. Select the prompt below and copy it manually."
                : "For your preferred AI agent."}
          </p>
        </div>
        <details
          className="onboarding-prompt"
          open={expanded}
          onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
          <summary>Read the setup prompt</summary>
          <label htmlFor="community-setup-prompt">Select and copy this prompt</label>
          <textarea
            id="community-setup-prompt"
            readOnly
            value={COMMUNITY_SETUP_PROMPT}
            rows={10}
            onFocus={(event) => event.currentTarget.select()}
          />
        </details>
      </div>
    </aside>
  );
}
