import { createDb } from "@hyphae/db";
import { env } from "./env.js";

export const db = createDb(env.DATABASE_URL);
