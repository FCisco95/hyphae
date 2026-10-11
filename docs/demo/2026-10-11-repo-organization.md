# Repository organization report — October 11

Report only. No refs, files, worktrees or stashes deleted. Main began at 4e6b99e, 42 commits ahead of origin/main d3b8c6c. Main and next diverge; any approved release must merge and preserve both histories.

| Ref | SHA | Commits not in origin/main |
|---|---|---:|
| `feat/jev-eval` | `707d7da` | 0 |
| `feat/rules-v2` | `158452f` | 7 |
| `feat/sonnet55-medium` | `dc17bc7` | 1 |
| `main` | `c5146cc` | 44 |
| `next` | `1249fed` | 62 |
| `origin/FCisco95/blink` | `146be88` | 3 |
| `origin/FCisco95/payout-status` | `621c887` | 5 |
| `origin/FCisco95/raid-stats` | `0112695` | 2 |
| `origin/FCisco95/scorer-v3` | `cabe201` | 5 |
| `origin/FCisco95/wallet-record` | `70e5b3c` | 3 |
| `origin/feat/jev-eval` | `707d7da` | 0 |
| `origin/feat/rules-v2` | `158452f` | 7 |
| `origin/hold/hyphae-combined` | `4e6b99e` | 42 |
| `origin/hold/hyphae-member-login` | `af96a28` | 37 |
| `origin/hold/mac-hyphae` | `57a3f8e` | 4 |
| `origin/main` | `d3b8c6c` | 0 |
| `origin/next` | `1249fed` | 62 |

The existing next worktree is C:/hy/next, at 1249fed. The untracked .codex directory contains local config/hooks files and was left untouched and unstaged. Session-check start reports these held histories, ahead main and the extra worktree. These are expected pending Cisco's disposition. A fully merged branch is still not deletion-authorized.

## After the approved release

The table above is the pre-release inventory. Release main `77e575d` is pushed; history-preserving merge `e7b6824` includes reviewed next `9d0da9b`. All five FCisco95 refs, all three hold refs, feat/jev-eval and next are now fully in origin/main; they remain intact. Local/origin feat/rules-v2 still have seven unique commits; local feat/sonnet55-medium has one. Existing next worktree retained. No stash/reset or held-ref deletion.

The plan's disposable detached exact-source worktree at 3a3e294 was unregistered after E6 and after proving its source is in origin/main. Its source/install files were removed; an empty directory residue was locked by a process. This cleanup does not touch the original next worktree. Final end check should report only pre-existing .codex, the unique feat histories and C:/hy/next; main must equal origin after the final docs push.
