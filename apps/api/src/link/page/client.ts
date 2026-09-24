import { type Post, verifyAndReconcile } from "./flow.js";
import { connect, type MessageWallet, messageWallets, onWalletRegister, sign } from "./wallet.js";

const token = location.hash.slice(1);
history.replaceState(null, "", location.pathname); // drop the token from the address bar and history
const status = document.getElementById("status") as HTMLElement;
const list = document.getElementById("wallets") as HTMLElement;
const say = (text: string) => {
  status.textContent = text;
};

const TEXT: Record<string, string> = {
  proof_rejected: "Link failed. Start again with /link.",
  wallet_taken: "That wallet is already linked to another member. Ask a community admin.",
  link_expired: "This link expired or was already used. Send /link in your community again.",
  link_unavailable: "Link is unavailable right now. Try again.",
};
const failed = (code: unknown) =>
  say(TEXT[typeof code === "string" ? code : ""] ?? (TEXT.link_unavailable as string));
const linkedText = (wallet: string) =>
  `Linked ${wallet.slice(0, 4)}…${wallet.slice(-4)}. You can close this page.`;

const post: Post = async (path, body) => {
  const r = await fetch(`/link/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({ error: "link_unavailable" })) };
};

async function run(w: MessageWallet) {
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
    say("Check your wallet and sign the message.");
    proof = { requestId, nonce, message, signature: await sign(w, account, message) };
  } catch {
    // Nothing was submitted yet: a refused connection or signature, or an unreachable server.
    return failed("proof_rejected");
  }
  const outcome = await verifyAndReconcile(post, token, proof);
  if ("linked" in outcome) return say(linkedText(outcome.linked));
  failed(outcome.error);
}

function render() {
  const wallets = messageWallets();
  list.replaceChildren();
  say(
    wallets.length === 0
      ? "No Solana wallet found in this browser. Open this link in your wallet app's browser."
      : "",
  );
  for (const w of wallets) {
    const button = document.createElement("button");
    const img = document.createElement("img");
    img.src = w.icon;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    button.append(img, ` ${w.name}`);
    button.onclick = () => void run(w);
    list.append(button);
  }
}

if (!/^[A-Za-z0-9_-]{43}$/.test(token)) failed("link_expired");
else {
  render();
  onWalletRegister(render);
}
