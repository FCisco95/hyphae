# October 11 local browser checks

These are **local pre-release previews**, not proof of a production deploy.

| Surface | Desktop | 390 px phone |
|---|---|---|
| Home | [home](home-desktop.png) | [home](home-phone.png) |
| Mainnet proof | [proof](proof-desktop.png) | [proof](proof-phone.png) |
| Epoch 2 settlement / four paid rows | [epoch](epoch2-desktop.png) | [epoch](epoch2-phone.png) |
| Clean claim page | [claim](claim-desktop.png) | [claim](claim-phone.png) |
| Connected mainnet paid claim | [connected](claim-connected-desktop.png) | [connected](claim-connected-phone.png) |
| Wallet record | [wallet](wallet-desktop.png) | [wallet](wallet-phone.png) |
| Wallet picker | — | [picker](wallet-picker-phone.png) |

- Fresh signed-out browser contexts; dark mode; desktop 1920×1080 and phone viewport 390×844. Phone full-page captures retain that viewport width.
- Home, epoch 2 and claim use local main source plus the mainnet public API. Mainnet proof contains all seven receipt links; current API read says 4/4 paid, claimed 1,238,881,509 lamports, unclaimed 0.
- All checked pages had document width at or below viewport width. All four paid rows and their signatures were present on epoch 2.
- Connected claim used a deliberately named Read-only preview wallet for the public C21 address. Its signing feature throws; no transaction submitted. Full address stayed visible; status Paid came from the real receipt; no Claim button appeared.
- Native dialog Close restored focus to Connect wallet in the real browser. Picker colors were the dark palette, not browser defaults.
- Wallet page used reviewed next source and a loopback-only GET adapter. The record came from the production database through readWalletRecord's repeatable-read, read-only transaction and mainnet RPC verification; no database write. Read time 2026-10-11T10:35:35.743000Z; epoch 2 payout was paid. No rules-test/hold outcome appeared.
- No deployed API/web version is implied by these screenshots. Combined-source gate and live E6 smoke remain required after release authorization.
