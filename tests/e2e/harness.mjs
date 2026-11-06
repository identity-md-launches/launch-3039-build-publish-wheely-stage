// Serves dist/ at a subpath (like an IPFS gateway would) and mocks the status API, so every
// state can be driven on demand. Also used by run.mjs.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff",
};

export const SUBPATH = "/ipfs/wheely-test/";

export async function serveDist(root = "dist") {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!path.startsWith(SUBPATH)) { res.writeHead(404); res.end(); return; }
    let file = join(base, path.slice(SUBPATH.length));
    if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
    try {
      if ((await stat(file)).isDirectory()) {
        if (!path.endsWith("/")) { res.writeHead(301, { Location: `${path}/` }); res.end(); return; }
        file = join(file, "index.html");
      }
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}${SUBPATH}`, close: () => server.close() };
}

/** A status body in the live API's shape. All overrides are telemetry the test chooses. */
export function statusBody(o = {}) {
  const now = o.now ?? Date.now();
  const observed = now - (o.ageSeconds ?? 2) * 1000;
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    measurement: {
      freshness: o.freshness ?? "online",
      observedAt: new Date(observed).toISOString(),
      staleAfterSeconds: o.staleAfterSeconds ?? 120,
      counterEpoch: o.epoch ?? "epoch-a",
      cumulativeWorkUnits: o.work ?? "11048",
      coreStatus: o.core ?? "IDLE",
      rpmMilli: o.rpmMilli ?? 0,
      speedMmPerSecond: o.speed ?? 0,
      distanceMm: o.distanceMm ?? 6348818,
    },
    builder: o.noAnchor
      ? { status: "unavailable" }
      : {
          status: "available",
          anchor: {
            cumulativeWork: o.anchorWork ?? "11048",
            blockHeight: o.block ?? "1140",
            settledThroughRound: o.round ?? "367",
          },
        },
  };
}

export const API = "https://api.squeekchain.com/v1/status";

/** Routes the API on a page or context. `state` is mutable; set state.fail or state.body. */
export async function mockApi(target, state) {
  await target.route(API, async (route) => {
    state.hits = (state.hits ?? 0) + 1;
    if (state.fail) return route.abort("failed");
    const body = typeof state.body === "function" ? state.body() : state.body;
    return route.fulfill({
      status: state.code ?? 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body),
    });
  });
}
