import { type Post, verifyAndReconcile } from "./flow.js";
import { copyWalletLink, privateWalletLink } from "./handoff.js";
import { connect, type MessageWallet, messageWallets, onWalletRegister, sign } from "./wallet.js";

const token = location.hash.slice(1);
let privateLink = privateWalletLink(location.origin, token);
history.replaceState(null, "", location.pathname); // drop the token from the address bar and history
const status = document.getElementById("status") as HTMLElement;
const list = document.getElementById("wallets") as HTMLElement;
const copy = document.getElementById("copy-link") as HTMLButtonElement;
const copyStatus = document.getElementById("copy-status") as HTMLElement;
const manual = document.getElementById("manual-copy") as HTMLElement;
const field = document.getElementById("private-link") as HTMLTextAreaElement;
const retry = document.getElementById("retry") as HTMLButtonElement;
const origin = document.getElementById("signing-origin") as HTMLElement;
origin.textContent = location.origin;
const say = (text: string) => {
  status.textContent = text;
};
let phase: "ready" | "busy" | "failed" | "finished" = "ready";

const TEXT: Record<string, string> = {
  proof_rejected:
    "The connection or signature was refused, or the message was rejected. Choose Try wallet selection again for a deliberate retry, or get a fresh /link in your group.",
  wallet_taken:
    "That wallet is already linked to another member. Ask your community owner; never use someone else's link.",
  link_expired:
    "This link expired or was already used. Get a fresh /link in your registered group; do not copy the stripped address bar.",
  link_unavailable:
    "The link's result cannot be confirmed. Check your own /me first: it may have completed. If not linked, return to your group for a fresh /link.",
};

function stopCopy() {
  privateLink = undefined;
  copy.disabled = true;
  field.value = "";
  manual.hidden = true;
  copyStatus.textContent = "This private link is no longer available to copy.";
}

function failed(code: unknown) {
  const error = typeof code === "string" && Object.hasOwn(TEXT, code) ? code : "link_unavailable";
  phase = error === "proof_rejected" ? "failed" : "finished";
  list.replaceChildren();
  say(TEXT[error] as string);
  retry.hidden = phase !== "failed";
  if (phase === "finished") stopCopy();
  else {
    copy.disabled = !privateLink;
    retry.focus();
  }
}

copy.onclick = async () => {
  const link = privateLink;
  if (!link || phase === "busy") return;
  const copied = await copyWalletLink(link, navigator.clipboard);
  // A verification may have finished while the clipboard permission dialog was open.
  if (link !== privateLink) return;
  if (copied) {
    field.value = "";
    manual.hidden = true;
    copyStatus.textContent =
      "Private link copied. Paste it in your wallet app's browser. Never forward it or send it to support.";
    copy.focus();
  } else {
    field.value = link;
    manual.hidden = false;
    copyStatus.textContent =
      "Clipboard unavailable. Select and copy the private link below, then paste it in your wallet app's browser.";
    field.focus();
    field.select();
  }
};

const post: Post = async (path, body) => {
  const r = await fetch(`/link/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({ error: "link_unavailable" })) };
};

async function run(w: MessageWallet) {
  if (phase !== "ready") return;
  phase = "busy";
  copy.disabled = true;
  field.value = "";
  manual.hidden = true;
  list.replaceChildren();
  let proof: { requestId: string; nonce: string; message: string; signature: string };
  try {
    const account = await connect(w);
    say("Preparing message…");
    const req = await post("request", { token, wallet: account.address });
    if (!req.ok) return failed(req.data.error);
    const { requestId, nonce, message } = req.data as {
      requestId: string;
      nonce: string;
      message: string;
    };
    say(
      "Check your wallet and sign the free readable message. Cancel any transfer, approval or seed-phrase request.",
    );
    proof = { requestId, nonce, message, signature: await sign(w, account, message) };
  } catch {
    // Nothing was submitted yet: a refused connection or signature, or an unreachable server.
    return failed("proof_rejected");
  }
  const outcome = await verifyAndReconcile(post, token, proof);
  if ("linked" in outcome) {
    phase = "finished";
    stopCopy();
    return say(
      `Linked ${outcome.linked.slice(0, 4)}…${outcome.linked.slice(-4)}. Return to your registered group and check your own /me shows the same wallet.`,
    );
  }
  failed(outcome.error);
}

function render() {
  if (phase !== "ready") return;
  const wallets = messageWallets();
  list.replaceChildren();
  say(
    wallets.length === 0
      ? "No Solana wallet found in this browser. On a phone, copy your private link into your wallet app's browser. On desktop, use a browser with a compatible wallet extension."
      : "Choose your wallet, then check and sign its free readable message.",
  );
  for (const w of wallets) {
    const button = document.createElement("button");
    const img = document.createElement("img");
    img.src = w.icon;
    img.alt = "";
    img.width = 44;
    img.height = 44;
    button.append(img, ` ${w.name}`);
    button.onclick = () => void run(w);
    list.append(button);
  }
}

retry.onclick = () => {
  if (phase !== "failed") return;
  phase = "ready";
  retry.hidden = true;
  render();
  (list.firstElementChild as HTMLButtonElement | null)?.focus();
};

if (!privateLink) failed("link_expired");
else {
  copy.disabled = false;
  render();
  onWalletRegister(render);
}
