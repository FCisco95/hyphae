import type { Program } from "@anchor-lang/core";
import * as anchor from "@anchor-lang/core";
import type { Hyphae } from "../target/types/hyphae";

describe("hyphae", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.hyphae as Program<Hyphae>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
