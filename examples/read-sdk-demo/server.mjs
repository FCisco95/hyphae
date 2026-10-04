import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { communities, fixture } from "./fixtures.mjs";

export function createDemoServer() {
  return createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/demo.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ fixture: true, communities }));
      return;
    }
    if (url.pathname.startsWith("/v1/")) {
      res.setHeader("Content-Type", "application/json");
      const mode = url.searchParams.get("fixtureScenario");
      if (mode === "rate_limit") {
        res.writeHead(429, { "Retry-After": "1" });
        res.end('{"error":"unavailable"}');
        return;
      }
      if (mode === "unavailable") {
        res.writeHead(503);
        res.end('{"error":"unavailable"}');
        return;
      }
      if (mode === "malformed") {
        res.end('{"mint":"unexpected"}');
        return;
      }
      const body = fixture(url);
      if (!body) {
        res.writeHead(404);
        res.end('{"error":"not_found"}');
        return;
      }
      const send = () => {
        if (!res.destroyed) res.end(JSON.stringify(body));
      };
      if (mode === "slow") {
        const timer = setTimeout(send, 2000);
        res.once("close", () => clearTimeout(timer));
      } else send();
      return;
    }
    const files = {
      "/": ["index.html", "text/html"],
      "/app.js": ["app.js", "application/javascript"],
      "/style.css": ["style.css", "text/css"],
    };
    const asset = files[url.pathname];
    if (!asset) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      res.setHeader("Content-Type", asset[1]);
      res.end(readFileSync(new URL(asset[0], import.meta.url)));
    } catch {
      res.writeHead(503);
      res.end("Build the local fixture demo first.");
    }
  });
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const port = Number(process.argv[2] ?? 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid local port");
  createDemoServer().listen(port, "127.0.0.1", () => {
    console.log(`LOCAL FIXTURE SDK DEMO: http://127.0.0.1:${port}`);
  });
}
