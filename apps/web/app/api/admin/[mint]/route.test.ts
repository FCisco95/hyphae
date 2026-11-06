import { describe, expect, it } from "vitest";
import * as intake from "./intake/route.js";
import * as overview from "./route.js";

describe("private admin route methods", () => {
  it("exposes GET only on overview and PUT only on intake", async () => {
    for (const handler of [
      overview.POST,
      overview.PUT,
      overview.PATCH,
      overview.DELETE,
      overview.OPTIONS,
      overview.HEAD,
      intake.GET,
      intake.POST,
      intake.PATCH,
      intake.DELETE,
      intake.OPTIONS,
      intake.HEAD,
    ]) {
      const response = await handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });
});
