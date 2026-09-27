import { it } from "vitest";
import { commitmentCases } from "./commitments.test-cases.js";

// Each case migrates a fresh database inside the test, so it gets the 0008 backfill test's timeout.
commitmentCases((name, run) => it(name, run, 30_000));
