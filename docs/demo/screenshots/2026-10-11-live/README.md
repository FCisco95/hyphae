# October 11 production browser smoke

Live production web at release SHA `77e575d6b3fbff72519caa512af148d517bb92ca`, Vercel success 12:47Z. Captured 12:49–12:51Z, after the pinned API/worker rollout. [Execution record](../../2026-10-11-release-plan.md#record).

| Surface | 1920×1080 dark | 390×844 dark viewport |
|---|---|---|
| Home | [home](home-desktop.png) | [home](home-phone.png) |
| Epoch 2 settlement / four paid rows | [settlement](epoch2-desktop.png) | [epoch](epoch2-phone.png) |
| Clean claim | [claim](claim-desktop.png) | [claim](claim-phone.png) |
| Connected paid C21 wallet | [connected](claim-connected-desktop.png) | [connected](claim-connected-phone.png) |
| Wallet record | [wallet](wallet-desktop.png) | [wallet](wallet-phone.png) |
| Single native picker | — | [picker](wallet-picker-phone.png) |

- Fresh signed-out browser contexts. Phone and wallet captures use full-page height at the named viewport width. Desktop settlement is scrolled to its panel.
- Actual live mainnet reads: four paid claims, 1.238881509 SOL claimed, 0 unclaimed, published allocation and C21 receipt. Wallet record includes provisional epoch 3 work and the paid epoch 2 record.
- Connected captures use a deliberately named Read-only smoke wallet sharing the public C21 address. Its signing feature throws; signing calls were zero and no transaction/Action POST occurred. They verify the released UI and real receipt, not a new Phantom approval.
- One picker, full connected address, Paid without a Claim button, Close restoring focus and Disconnect restoring Connect passed. No horizontal overflow or browser page errors at either size. Home, proof, trust, schedule notice, Scored rows, wallet record and Actions/CORS passed.
- Waiting timeout/retry, account switching and late-signature recovery have the fresh ACCEPT review and mounted tests. All allocations are already paid, so the smoke did not sign another claim. Cisco confirmed the private /me flow separately.
