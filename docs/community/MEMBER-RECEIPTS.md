# Member receipts and private checklists

Use the bot's raid buttons to submit work for the named community and raid. A private receipt belongs to the submitting member and is checked again on every read. It records the submission, selected decision, exact points and audit link. Submission in private chat does not make a later group scoring announcement private.

| State | Meaning |
|---|---|
| Received / pending dispatch | Work is stored; queue dispatch may still need confirmation. |
| Pending scoring | No accepted decision exists yet. |
| Scored | A decision and its reason exist; a zero remains visible. |
| Counted, provisional | Points contribute to the open epoch; points are not SOL. |
| Counted, frozen / excluded at cutoff | The closed snapshot selected the decision or recorded its exclusion reason. |

After a raid ends or a member leaves, the member retains read/report access to their own history. New submissions and dispatch retries still require current membership. The bot checks community and caller identity; a forwarded receipt grants no access.

Group /me shows a neutral link to **Open my private checklist**. The checklist opens in private chat after identity and membership checks. Per-member rules-test and token-hold outcomes stay private; public audit pages retain contributions, allocations, payments and aggregates.

To report a score, send /issue with the receipt ID and a specific reason in private chat. A stored issue is not a correction or promised response. Stored reports are limited to three per receipt, with a 60-second interval between distinct messages; retries of the same message preserve the original report.

A wallet link does not establish every eligibility gate at close. A cached signature, allocation or root is not payment proof. Check the [epoch settlement](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2) and confirmed claim receipt for payment. Account ownership and target relation remain separately unverified by the text scorer.
