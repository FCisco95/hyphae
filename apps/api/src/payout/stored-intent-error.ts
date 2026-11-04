// A stored publication or distribution intent that fails its own consistency checks: a text that
// does not parse, is not canonical, does not hash to its stored hash, or does not rebuild the
// stored leaves and root. Readers match this class, never the message: the failure is a verdict
// on the stored bytes, while database and infrastructure errors are not and must propagate.
export class StoredIntentInconsistent extends Error {
  override readonly name = "StoredIntentInconsistent";
}

// Runs a pure check or rebuild of stored bytes. Anything it throws that is not already typed
// (c14n refusing a lone surrogate, a number that does not parse) is a verdict on those bytes too.
export function rebuildingStored<T>(describe: (what: string) => Error, rebuild: () => T): T {
  try {
    return rebuild();
  } catch (error) {
    if (error instanceof StoredIntentInconsistent) throw error;
    throw describe(error instanceof Error ? error.message : String(error));
  }
}
