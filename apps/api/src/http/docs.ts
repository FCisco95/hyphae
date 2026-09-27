import { Hono } from "hono";

// The read API's reference page. Its renderer runs on the api's origin, so it is pinned to one
// version and checked by hash: a changed file on the CDN is refused by the browser.
const SCALAR =
  "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1/dist/browser/standalone.js";
const SCALAR_SHA384 = "sha384-U11tb2XnKvmwt8RlTvnwUnYgrN+ur4Xyh9htLhjajWNR/Oyl5AX5DEz00qRmlrmK";

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hyphae read API</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR}" integrity="${SCALAR_SHA384}" crossorigin="anonymous"></script>
    <script>
      Scalar.createApiReference("#app", { url: "/v1/openapi.json" });
    </script>
  </body>
</html>
`;

export function docsRoutes() {
  const app = new Hono();
  app.get("/", (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.html(page);
  });
  return app;
}
