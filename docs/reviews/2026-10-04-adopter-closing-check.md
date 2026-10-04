---
type: review
project: hyphae
summary: "ACCEPT of 64d71bf0..202fe957 closing shim and early-timer proof corrections; seven targeted tests plus counterfactual, native Windows unknown."
updated: 2026-10-04
---

# Hyphae closing check

Read-only acceptance by Claude Opus 5.5 (claude-opus-5-5, low effort) of exact delta 64d71bf..202fe95, HEAD 202fe95 clean, scoped to the two notes only. (1) ACCEPT process-tools: native extensionless branch now returns resolve(candidate) so argv0 keeps the pnpm symlink name, and pnpmInvocation still gives shell:false with separate args. Actual reruns: node --test process-tools.test.mjs 7/7 pass on Node 24.14.0 darwin, syntax checks ok, and a scratchpad counterfactual through a node-as-pnpm symlink got argv0 node with the old 64d71bf module versus pnpm with the new one. (2) ACCEPT regressions.mjs by static review: Date.now ticks +1ms per call, so app.js scheduleCooldown computes remaining <=999 from Retry-After 1. The window 750<delay<=1000 excludes the SDK timeoutMs 750 and bootstrap 2000 timers. __cooldownEarlyInjected is asserted for all/early-cooldown after the error state, which is set in the same sync block as the setTimeout. The early callback only reschedules, so controls stay disabled and shared-control recovery to DemoB is intact. bootstrapRecovery now reports only all/bootstrap. Residual: Chromium regression, lint 309 and native-Node owner receipts are prior evidence, not rerun here (the browser run needs a demo build, outside read-only scope). Native Windows is UNKNOWN; the symlink main-module nit stays documented. No files modified, no report written.
