import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

process.env.APP_URL = "https://idaevia.app";
const request = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  proxy(new NextRequest(`https://idaevia.app${path}`, { method, headers }));

test("desktop home redirects into protected platform; browser home stays public", () => {
  const desktop = request("/", { "user-agent": "IDAEVIA-Desktop/0.1.0" });
  assert.equal(desktop.headers.get("location"), "https://idaevia.app/app");
  assert.match(desktop.headers.get("cache-control")!, /no-store/);
  assert.equal(request("/").headers.get("location"), null);
});

test("API mutations reject untrusted origins, including same-site subdomains", () => {
  for (const headers of [
    { origin: "https://evil.example" },
    { origin: "https://evil.idaevia.app", "sec-fetch-site": "same-site" },
    { origin: "https://evil.example", "sec-fetch-site": "same-origin" },
    { origin: "null" },
    { origin: "http://idaevia.app" },
    { "sec-fetch-site": "cross-site" },
    { referer: "https://evil.example/page" },
  ] as Record<string, string>[]) assert.equal(request("/api/projects", headers, "POST").status, 403);
});

test("same-origin requests and signed webhook routes remain usable", () => {
  assert.equal(request("/api/projects", { origin: "https://idaevia.app" }, "POST").status, 200);
  assert.equal(request("/api/projects", { "sec-fetch-site": "same-origin" }, "POST").status, 200);
  assert.equal(request("/api/webhooks/whop", {}, "POST").status, 200);
});

test("desktop starts in platform with no remote native permissions or shell commands", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  assert.equal(config.app.windows[0].url, "/app");
  assert.match(config.app.windows[0].userAgent, /IDAEVIA-Desktop\//);
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(config.app.windows[0].devtools, false);
  const capability = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"));
  assert.equal(capability.remote, undefined);
  assert.deepEqual(capability.permissions, []);
  assert.doesNotMatch(readFileSync("src-tauri/src/lib.rs", "utf8"), /invoke_handler|tauri::command|std::process/);
});
