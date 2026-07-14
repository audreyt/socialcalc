// Deterministic static file server for the real-browser Playwright suite.
//
// Serves the repository's build artifacts (dist/, images/, css/) and jQuery
// (a documented runtime requirement, README "Requirements") from a fixed
// root so relative asset URLs (e.g. the default `images/sc_` image prefix)
// resolve exactly as they would for a real host page. Also serves generated
// fixture pages that load either the normal or minified UMD bundle.
//
// Started by Playwright's `webServer` option (see ../playwright.config.ts)
// via `vp node e2e/server.ts` — plain Node `http`/`fs`, matching the
// project's non-Bun-runtime workflow (AGENTS.md: Vite+ owns Bun as its
// package manager, not as an app runtime). Not part of `vp test` / Vitest.

import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { extname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.SOCIALCALC_E2E_PORT ?? 4173);

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

// Static roots reachable at the request path prefix that names them, e.g.
// GET /images/sc_bold.gif -> <repoRoot>/images/sc_bold.gif.
const staticDirRoots: Record<string, string> = {
  "/css/": join(root, "css"),
  "/dist/": join(root, "dist"),
  "/images/": join(root, "images"),
};
const staticFileRoots: Record<string, string> = {
  "/vendor/jquery.js": join(root, "node_modules/jquery/dist/jquery.js"),
};

function fixturePage(bundlePath: string, minified: boolean): string {
  // A minimal host page: one container div, jQuery (SpreadsheetControl's
  // only client-side requirement per README), the stylesheet, and the UMD
  // bundle under test. No toolbar chrome is hidden — InitializeSpreadsheetControl
  // builds the full default toolbar/formula bar/tab bar, matching real usage.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SocialCalc e2e fixture (${minified ? "minified" : "normal"})</title>
<link rel="stylesheet" href="/css/socialcalc.css">
<style>html,body{margin:0;padding:0;} #containerDiv{position:relative;}</style>
</head>
<body>
<div id="containerDiv"></div>
<script src="/vendor/jquery.js"></script>
<script src="${bundlePath}"></script>
</body>
</html>`;
}

/** True when `candidate` resolves inside `dir` (rejects `..` traversal and root escapes). */
function isWithinDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(`..${"/"}`) && rel !== "..";
}

function serveStatic(filePath: string, response: ServerResponse): void {
  if (!existsSync(filePath)) {
    response.writeHead(404).end("Not found");
    return;
  }
  const type = mimeTypes[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": type });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const path = url.pathname;

  if (path === "/normal.html") {
    response
      .writeHead(200, { "content-type": mimeTypes[".html"] })
      .end(fixturePage("/dist/SocialCalc.js", false));
    return;
  }
  if (path === "/minified.html") {
    response
      .writeHead(200, { "content-type": mimeTypes[".html"] })
      .end(fixturePage("/dist/SocialCalc.min.js", true));
    return;
  }

  const staticFile = staticFileRoots[path];
  if (staticFile) {
    serveStatic(staticFile, response);
    return;
  }

  for (const [prefix, dir] of Object.entries(staticDirRoots)) {
    if (!path.startsWith(prefix)) continue;
    const resolved = join(dir, path.slice(prefix.length));
    if (!isWithinDir(dir, resolved)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    serveStatic(resolved, response);
    return;
  }

  response.writeHead(404).end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`socialcalc e2e fixture server listening on http://127.0.0.1:${port}`);
});
