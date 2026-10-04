import type { Db } from "@hyphae/db";
import { type SQL, sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";

// Our driver-agnostic Db erases execute's result type. Validate the two supported driver
// shapes here, while letting pg-boss's adapter construct every parameterized query.
export const submissionQueueDb = (tx: Db) =>
  fromDrizzle(
    {
      async execute(query) {
        const result: unknown = await tx.execute(query as SQL);
        if (Array.isArray(result)) return result;
        if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows))
          return { rows: result.rows };
        throw new Error("Unsupported queue transaction result");
      },
    },
    sql,
  );
