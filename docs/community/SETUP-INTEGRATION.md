# Community setup and Organic integration

Local operator tooling; no production community is registered by this guide. Hyphae is a shared bot/service. Each token community uses its own registered Telegram contribution group and `/c/<mint>` audit page. Lab is the MYCEL pilot, not the destination for every community.

## Current usable boundary

`apps/api/scripts/community-setup.ts` provides three private operator commands:

| Command | Behavior |
|---|---|
| `plan` | Offline validation and reviewable SHA-256 plan; reads no credentials and makes no provider/DB calls |
| `check` | Reads exact bot/group/admin and DB registration; reports ready, existing, conflict or unavailable |
| `apply` | Requires exact reviewed hash and environment; atomically registers one paused community with a pinned future epoch |

This is operator-assisted setup. It is not public self-service, a new owner login, a full admin dashboard or deployed Organic integration. Group administrator status does not establish ownership of a token/community inside Organic.

## Private manifest contract

Store the manifest outside the repository, in the operator's approved private location. It contains group/account identifiers and the approval reference; keep it out of public screenshots, build logs and commits. It contains no credential, wallet-link token, signature or private key.

| Field | Requirement |
|---|---|
| `version` | Exactly `1` |
| `environment` | Explicit `disposable` or `production` |
| `database` | Exact `host`, `port` and database `name`, without credentials; binds the connection target into the reviewed hash |
| `communityId` | New lowercase UUID retained across retries/read-back |
| `mint` | Valid 32-byte base58 address; mint existence/network and community authority are operator checks, not proved by syntax |
| `name` | This community's name; no Lab default |
| `telegramChatId` | Exact negative numeric group ID as a string; one contribution group per mint |
| `adminTelegramUserId` | Designated administrator's positive numeric ID as a string |
| `botUserId` | Expected official bot's numeric ID as a string, verified with `getMe` |
| `approvalReference` | Reference to the operator's recorded community/mint authority and approved configuration; not an authentication token |
| `activationTime` | Explicit zoned ISO timestamp on a whole-second boundary; must still be future by DB clock when creating the registration |
| `rewardConfig` | Complete existing version-2 pinned configuration, including this community's rubric and a registered prompt hash |

Use the existing `buildRewardConfigPayload` helper to prepare an explicitly approved rubric/configuration; the setup parser does not choose another community's rules. Unknown/discarded fields, mismatched rubric identity, invalid weights and unknown prompt pins fail validation. The offline plan includes private IDs; review it privately.

## Operator procedure

1. Establish the owner's authority over the selected Organic token community through the existing operator process. Record a reference covering the exact mint, designated administrator, group, environment and pinned rules. A public community page or Telegram role alone is insufficient.
2. The owner selects or creates their own group and adds the official shared bot as an administrator. This tool creates no Telegram group, sets no permissions, consumes no updates and sends no message. Its reads require reliable member lookup, for which Telegram guarantees results when the bot is an administrator.
3. Prepare the private manifest and run an offline plan from `apps/api`:

   ```sh
   node --import tsx scripts/community-setup.ts plan --manifest /absolute/private/community.json
   ```

4. Review the exact plan, especially its community/group/admin, database target, pinned configuration and timestamp. Preserve the hash and original manifest for read-back.
5. Under the intended environment's separately authorized connection, run `check`. The private environment file supplies `COMMUNITY_SETUP_DATABASE_URL` and `TELEGRAM_BOT_TOKEN`. There is no fallback to ambient `DATABASE_URL`. The URL must include an explicit port; host/port/database must match the manifest and are also pinned as driver options. Multi-host/comma authorities, repeated raw `@` delimiters, whitespace and connection-query overrides are refused. Percent-encode reserved credential characters. Disposable targets must be loopback; remote production targets require `sslmode=verify-full`, also enforced as a driver option.

   ```sh
   node --env-file=/absolute/private/setup.env --import tsx scripts/community-setup.ts check --manifest /absolute/private/community.json --environment disposable
   ```

6. Only in an explicitly authorized setup sitting, apply the privately reviewed hash:

   ```sh
   node --env-file=/absolute/private/setup.env --import tsx scripts/community-setup.ts apply --manifest /absolute/private/community.json --environment disposable --approve <reviewed-plan-sha256>
   ```

   The production label must be explicit in both manifest and command; it never follows from an example, plan or local test. Creating a new real community is a production data operation with its own authorization.

7. Read back with `check`. Registration is paused; the first pinned epoch exists, `firstPaidEpoch` remains null and no chain community/vault is created. Configure verified group/support links for that mint through the current presentation configuration, and prepare the group welcome/pins through the existing participant release packet. These links currently remain operator-managed; there is no Organic settings feed or owner editor yet.
8. Read that community's actual `/c/<mint>` page and verify the same-group/member command journey under the attended test scope. `/community` is the default-community navigation alias and must not be used as every community's destination. Reward-intake activation, Telegram messages/menu/pins, deployment and funding retain separate gates.

For existing communities the administrator uses `/raid` for briefs, members use `/link`, `/rules`, `/submit`, `/effort` and `/me`, and evidence lives on their own audit pages. Corrections and future rule changes still use the existing reviewed operator tools and immutable-epoch/cooldown rules. No current-epoch configuration edit or money control is exposed by setup.

## Idempotency and recovery

An exact replay returns `existing` without overwriting names/admins, resetting intake or adding epochs. UUID, mint and chat conflicts refuse, never rebind. The complete original plan hash and approval reference are retained in the bootstrap proposal's `proposedBy` marker; changed plans do not count as the same setup.

Community creation and pinned-epoch bootstrap are one transaction. A partially created community would otherwise enter the legacy scoring path, so no unpinned row may commit. New intake starts paused. An activation time that passes during a lock wait is refused against the database clock.

`setup_outcome_unknown` means success cannot be determined from the exception. Run `check` with the original manifest before any deliberate retry. `existing` establishes the committed registration; `ready` establishes that no matching registration exists at that read. Conflicts/unavailability need operator diagnosis, not a new UUID, reseeding or automatic retry. Neither outcome is proof of bot deployment, member signing or payments.

The repeat/check comparison deliberately includes current group/admin/name/rubric fields. A later authorized group migration, rename, administrator change or rubric staging can therefore make the original manifest report `registration_conflict` even though its original registration committed correctly. This is not permission to replace the community; reconcile the original immutable bootstrap marker and current identity through authorized read-only operator access. Telegram is checked before the DB read, so an outage or demoted bot can also block automated reconciliation. Use authorized read-only DB diagnosis when that preflight is unavailable, never bypass the guard with a new registration. Prefer the intended stable group type before registering a new community; existing Lab placement remains its own guarded operation.

## Organic-owned follow-up contract

The Organic community page should provide a setup checklist/deep links and verified community-specific settings. The required authenticated contract must specify:

- Which server establishes the actor's authority over the exact token community and which actions that authority permits.
- How the intended Telegram group/admin is verified and how a provisioning request is scoped, expires and resists replay.
- Which name, official-link and guidance fields can change; reward rules remain subject to prospective activation and current-epoch immutability.
- Who records the approval/provisioning receipt, conflict disposition and idempotency identity.
- How two communities are tested for independent settings, members, submissions, costs and administrator actions.

Hyphae's currently permitted Organic interface is the public settlement GET only. A settings feed and owner-authorized provisioning require a separately scoped Organic change; this repo does not implement or assume them. Existing generic welcome/help works for registered communities, not for arbitrary groups just because the bot was added.

## Validation and release

Unit/PGlite tests cover manifest/target refusal, read-only preflight, two-community welcome isolation, paused intake, exact replay, conflicts and rollback. Real Postgres tests use two independent pools for duplicate/conflicting requests, lost-COMMIT reconciliation and expiry during a lock wait. No provider scoring experiment or real holder is used.

Before publication: repository gate, real-Postgres checks and fresh other-family review of this setup arc. No schema, SDK or reward-policy change is included. SDK stays 0.1.0 through October 12; Sentinel remains PARKED F-13; existing payout gates remain unchanged.

Primary sources checked October 3: [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [grammY API](https://grammy.dev/ref/core/api), [Telegram getChatMember](https://core.telegram.org/bots/api#getchatmember). Context7 was unavailable; current official documentation and installed package types were used.
