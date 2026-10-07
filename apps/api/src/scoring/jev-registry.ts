import type { JevRegistry } from "./scorers.js";

// Jev scorers this build knows by version. The question set's author adds an entry here, built
// with jevTemplateHash over the set. Empty on purpose: no Jev version is pinnable until one exists.
export const JEV_REGISTRY: JevRegistry = new Map();
