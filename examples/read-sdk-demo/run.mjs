import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemo } from "./build.mjs";

const port = Number(process.argv[2] ?? 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid local port");
const output = await buildDemo();
const { createDemoServer } = await import(pathToFileURL(join(output, "server.mjs")).href);
const server = createDemoServer();
server.listen(port, "127.0.0.1", () =>
  console.log(`LOCAL FIXTURE SDK DEMO: http://127.0.0.1:${port}`),
);
for (const event of ["SIGINT", "SIGTERM"])
  process.once(event, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
