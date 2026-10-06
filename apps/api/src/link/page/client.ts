import { answerOf, type Post, verifyAndReconcile } from "./flow.js";
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
const app = document.getElementById("app") as HTMLElement;
const preview = document.getElementById("preview") as HTMLElement;
const previewText = document.getElementById("message-preview") as HTMLElement;
const origin = document.getElementById("signing-origin") as HTMLElement;
origin.textContent = location.origin;
const say = (text: string) => {
  status.textContent = text;
};
let phase: "ready" | "busy" | "failed" | "finished" = "ready";

// The stylesheet reads these two attributes; nothing else about the page's behavior depends on them.
type View = "ready" | "empty" | "busy" | "failed" | "done" | "ended";
const show = (state: View, step: 1 | 2 | 3 | 4) => {
  app.dataset.state = state;
  app.dataset.step = String(step);
};

const TEXT: Record<string, string> = {
  proof_rejected:
    "The wallet's answer was refused or could not be sent. Nothing was linked. Choose Try again, or send /setup in your group for a fresh link.",
  wallet_connect:
    "Your wallet did not connect. Open this page inside the Phantom or Solflare app's browser, unlock the wallet, then choose Try again.",
  sign_refused:
    "The message was not signed, so nothing was linked and nothing moved. Choose Try again when you are ready to sign.",
  wallet_taken:
    "That wallet is already linked to another member. Ask your community owner; never use someone else's link.",
  link_expired:
    "This link expired or was already used. Send /setup in your registered group for a fresh link. Do not copy the shortened address bar.",
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

// A refused or failed attempt can be retried on purpose; every other outcome ends this link.
const RETRYABLE = new Set(["proof_rejected", "wallet_connect", "sign_refused"]);

function failed(code: unknown) {
  const error = typeof code === "string" && Object.hasOwn(TEXT, code) ? code : "link_unavailable";
  phase = RETRYABLE.has(error) ? "failed" : "finished";
  list.replaceChildren();
  preview.hidden = true;
  say(TEXT[error] as string);
  retry.hidden = phase !== "failed";
  if (phase === "finished") {
    stopCopy();
    show("ended", 1);
  } else {
    show("failed", 1);
    copy.disabled = !privateLink;
    retry.focus();
  }
}

const copyAllowed = () => phase !== "busy" && !!privateLink;

copy.onclick = async () => {
  const link = privateLink;
  if (!link || !copyAllowed()) return;
  const copied = await copyWalletLink(link, navigator.clipboard);
  // A verification may have finished while the clipboard permission dialog was open.
  if (link !== privateLink || !copyAllowed()) return;
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
  return answerOf(r);
};

async function run(w: MessageWallet) {
  if (phase !== "ready") return;
  phase = "busy";
  copy.disabled = true;
  field.value = "";
  manual.hidden = true;
  list.replaceChildren();
  show("busy", 2);
  say("Approve the connection in your wallet…");
  let account: Awaited<ReturnType<typeof connect>>;
  try {
    account = await connect(w);
  } catch {
    return failed("wallet_connect");
  }
  say("Preparing message…");
  let req: Awaited<ReturnType<Post>>;
  try {
    req = await post("request", { token, wallet: account.address });
  } catch {
    // Nothing was submitted: the server was unreachable.
    return failed("proof_rejected");
  }
  if (!req.ok) return failed(req.data.error);
  const { requestId, nonce, message } = req.data as {
    requestId: string;
    nonce: string;
    message: string;
  };
  previewText.textContent = message;
  preview.hidden = false;
  show("busy", 3);
  say(
    "Check your wallet and sign the free readable message. Cancel any transfer, approval or seed-phrase request.",
  );
  let signature: string;
  try {
    signature = await sign(w, account, message);
  } catch {
    return failed("sign_refused");
  }
  const outcome = await verifyAndReconcile(post, token, { requestId, nonce, message, signature });
  if ("linked" in outcome) {
    phase = "finished";
    stopCopy();
    preview.hidden = true;
    show("done", 4);
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
  show(wallets.length === 0 ? "empty" : "ready", 1);
  say(
    wallets.length === 0
      ? "No Solana wallet found in this browser. On a phone, copy your private link into your wallet app's browser. On desktop, use a browser with a compatible wallet extension."
      : "Choose your wallet, then check and sign its free readable message.",
  );
  for (const w of wallets) {
    const button = document.createElement("button");
    button.className = "wallet";
    const img = document.createElement("img");
    img.src = w.icon;
    img.alt = "";
    img.width = 40;
    img.height = 40;
    const name = document.createElement("span");
    name.className = "wallet-name";
    name.textContent = w.name;
    const note = document.createElement("span");
    note.className = "wallet-note";
    note.textContent = "Detected";
    button.append(img, name, note);
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

if (!/^[A-Za-z0-9_-]{43}$/.test(token)) failed("link_expired");
else {
  copy.disabled = !privateLink;
  if (!privateLink)
    copyStatus.textContent =
      "Private-link copy needs the official HTTPS page. Open the ORIGINAL bot URL.";
  render();
  onWalletRegister(render);
}
