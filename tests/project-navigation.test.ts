import assert from "node:assert/strict";
import { test } from "node:test";
import { protectProjectNavigation } from "../src/lib/project-navigation";

test("generated previews include a guard for platform links and form submits", () => {
  const html = protectProjectNavigation("<!doctype html><html><body><a href=\"/login\">Log in</a><form action=\"https://idaevia.app/app\"><button>Continue</button></form></body></html>");
  assert.match(html, /data-idaevia-project-navigation/);
  assert.match(html, /document\.addEventListener\('submit'/);
  assert.ok(html.includes("idaevia\\.app"));
});
