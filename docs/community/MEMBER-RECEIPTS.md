# Private member submission receipts

This journey is implemented and tested locally. It is not a production release. The existing private-alert release approval is still pending; the new source and additive migration need their own reviewed release scope. No real Telegram message, wallet signature, phone session or claim transaction is proved by these fixtures.

An authorized designated admin selects a raid target. A member who enabled that community's private alerts can choose **Submit my reply** or **Submit my quote** from the raid, then reply to the bot's specific prompt with their own post URL. The server binds that prompt to the caller, community, raid and declared kind. A different or newer raid cannot silently take that submission. The declared kind is the member's assertion, not evidence that X actually linked the post to that target.

The receipt names the exact raid, target, submitted URL, received time and receipt ID. Keep that ID. Use `/receipt <receipt ID>` or **Refresh receipt** privately to read the current result. A receipt reference grants no access by itself: the bot checks the caller and the linked member, community, task, contribution and prompt on every read. Members retain access to read and report issues on their own history after a raid expires, closes or is cancelled, or after leaving the group. New submissions and dispatch retries still require current membership in that exact registered group; departing does not grant a retry exception. Pending work remains visible to the designated admin.

Both the pre-submission prompt and the private receipt disclose that the existing scorer may post the result publicly in the group, replying to the raid message. A private submission or receipt does not promise a private scoring announcement. The frozen worker's existing group notification behavior is unchanged.

| Receipt state | What it establishes |
| --- | --- |
| Received | The contribution and receipt were recorded for the named raid. |
| Pending dispatch | The work is stored, but queue dispatch has not been confirmed. Retry the same original submission if this persists. |
| Pending scoring | There is no accepted scoring decision. A queue request does not establish scoring success. |
| Scored | A decision exists, with credited quality, raw quality, revision and a reason. A zero-point decision stays in the audit and is excluded from positive credit. |
| Counted, provisional | The selected decision currently contributes points to the open epoch. Points are not SOL. |
| Counted, frozen | The closed snapshot selected that decision. Later decisions do not replace it. |
| Excluded at cutoff | No decision qualified before close, or evidence/evaluation was still pending. The receipt explains which reason the frozen audit recorded. |

The receipt uses the existing audited reward selection and frozen snapshots. It does not write decisions, change epoch timing, calculate a new payout, or change the frozen reward worker.

Target relation and X account ownership are separate, both currently **unverified**. The existing capture can show text and a displayed author, but it does not provide a trustworthy structured reply/quote parent or proof that the Telegram caller controls that X account. First-seen handle binding prevents some conflicting submissions; it is not account ownership verification. Model judgments are also not ownership evidence. The approved human authorship-attestation process for the current payout remains in force.

Eligibility remains subject to the existing wallet, rules, holder, authorship/duplicate and safety gates. A current signed wallet link does not prove the member passed those gates at epoch close. A stored allocation is shown as an amount for the whole member epoch, not as a payment for this individual post. Claimability requires verified on-chain publication. Actual payment requires a confirmed claim receipt. This private receipt does not perform those chain checks and says so explicitly; an epoch root, a stored allocation or a cached transaction string is not treated as payment proof. The audit link opens the existing contribution page.

To report a scoring issue, send `/issue <receipt ID> <what seems wrong>` privately, with up to 1,000 characters. The report is attached to the caller's original receipt. The first report is accepted immediately. Technical abuse limits allow three stored reports per receipt, with at least 60 seconds between distinct messages; the database clock and a receipt-row lock enforce both bounds across concurrent processes. Retries of the same Telegram message return the same report ID and preserve the original text, even during the cooldown or after the storage limit. Existing reports remain recorded when a follow-up is refused. Further context can be taken to the community's designated admin, without a promised response or action. These are storage and request limits; they do not decide dispute merits or change scoring, eligibility, frozen decisions, allocations or payout rules. A confirmation means the report was stored for operator review; it promises no response time and does not automatically change those outcomes.

Council permissions remain blocked on Organic's authoritative community-specific role and Telegram identity contract. Until that contract is available and reviewed, the designated-admin guard remains the source of target/lifecycle authority. Telegram group administration, alert subscription, wallet linking and member receipts grant no council authority.

Local receipt coverage includes cross-community and wrong-caller refusals, repeated issue requests, stale callback acknowledgements, provisional and zero-point results, frozen selection despite late corrections, expired/closed/cancelled history, and refusing to infer payment from cached settlement fields. An attended first-time phone run and any real messages, signatures or claim transactions still need their separate scope.
