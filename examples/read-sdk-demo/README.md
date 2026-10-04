# Local SDK adopter app

This is a small reference app using an **independently installed tarball** of `@hyphae/read-client`. It shows two synthetic communities, their current epochs/points, and separate allocation/payment states. The fixture label is always visible. No real community, signature, payment or eligibility is proved.

From the Hyphae root after `pnpm install --frozen-lockfile`:

```sh
node examples/read-sdk-demo/run.mjs
```

Open `http://127.0.0.1:8788`. An optional port is the only run argument. Stop with Ctrl-C. The command builds/packs the SDK, installs its tarball into a disposable project outside the workspace with prefer-offline dependencies and scripts disabled; missing dependency metadata may be fetched with one retry, a20-second fetch timeout and a120-second process limit, bundles this app as that consumer, removes the temporary install, then serves the resulting app on loopback. The generated `dist/` app needs only Node to run with `node examples/read-sdk-demo/dist/server.mjs`.

Choose Fern or Moss to see their data stay separate. Fern has counted/pending work and no settlement; Moss is closed/empty with no payable members. Use the response selector to demonstrate 503, 429, malformed data and a deadline. On failures, values become **Unavailable**, not zero. Only a deliberate healthy read restores known counts. All three read controls are disabled during the fixture's one-second Retry-After, and the handler also guards synthetic change events; real API headers may be hidden by browser CORS. A cancelled slow read cannot overwrite a newer community selection. Bootstrap HTTP/network/JSON/config failures clear busy state and show an unavailable message; Read again retries the configuration.

All community/epoch data passes through the packed SDK. `/demo.json` supplies only this example's synthetic selector configuration. `fixtureScenario` is a local fixture query injected by this consumer's custom Fetch implementation; it is not an API v1 feature or a production configuration entry. The app has no live mode, wallet connection, provisioning, signing or source publication.

Build tools are reused from the repository's existing SDK tooling. Runtime app output has no workspace-source imports. Generated bundle, report and captioned screenshots are ignored under `dist/`; permanent source is this directory.

Verify with an already installed Playwright entrypoint:

```sh
node examples/read-sdk-demo/verify.mjs /absolute/path/to/playwright/index.mjs
```

The check runs both communities, unavailable versus real zero, four failures and recovery, cancelled-read isolation, keyboard controls and 1280/390/320px overflow checks. It closes its own local server/browser and saves `dist/verification.json`. Desktop fixture proof is not the registered-Lab phone flow or C21.

For a deliberately empty package store and metadata cache:

```sh
node examples/read-sdk-demo/verify.mjs /absolute/path/to/playwright/index.mjs --empty-store
node examples/read-sdk-demo/regressions.mjs /absolute/path/to/playwright/index.mjs
node --test examples/read-sdk-demo/build.test.mjs examples/read-sdk-demo/process-tools.test.mjs
```

The first command removes its disposable store/cache after building the isolated consumer. The UI regressions prove configuration retry, that every read trigger shares the cooldown, and eventual recovery after an early timer callback. The Node tests use actual pnpm to install/import the SDK from a disposable path containing spaces, #, % and non-ASCII characters. The archive is copied into the consumer and referenced as `file:./sdk.tgz`, avoiding pnpm’s handling of encoded absolute paths. Run the build test after the demo has packed the SDK. Package-manager JavaScript is invoked through Node with separate arguments; executable extensionless POSIX pnpm and native pnpm.exe run directly, avoiding cmd/bat quoting; main-module detection uses Node path/file-URL APIs. Windows-shaped arguments/URLs are tested on this Mac; actual native Windows execution remains **UNKNOWN/unavailable**. No credential or backend/CORS changes are included.

Start the generated server by its real path. Launching it through a symlink is not covered by the main-module guard.
