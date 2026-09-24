import assert from "node:assert/strict";
import { test } from "node:test";
import { embedFixRequest, frameBlockReason } from "../src/lib/preview-embedding";

const origin = "https://idaevia.app";
test("a preview that refuses framing is detected from its headers, not guessed", () => {
  assert.equal(frameBlockReason(new Headers(), origin), null);
  assert.match(frameBlockReason(new Headers({ "x-frame-options": "SAMEORIGIN" }), origin)!, /X-Frame-Options: SAMEORIGIN/);
  assert.match(frameBlockReason(new Headers({ "X-Frame-Options": "deny" }), origin)!, /DENY/);
  assert.match(frameBlockReason(new Headers({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" }), origin)!, /frame-ancestors 'none'/);
  assert.match(frameBlockReason(new Headers({ "content-security-policy": "frame-ancestors 'self'" }), origin)!, /frame-ancestors 'self'/);
  assert.equal(frameBlockReason(new Headers({ "content-security-policy": "default-src 'self'; frame-ancestors 'self' https://idaevia.app" }), origin), null);
  assert.equal(frameBlockReason(new Headers({ "content-security-policy": "frame-ancestors 'self' https://*.idaevia.app idaevia.app" }), origin), null);
  assert.equal(frameBlockReason(new Headers({ "content-security-policy": "frame-ancestors *" }), origin), null);
  assert.equal(frameBlockReason(new Headers({ "content-security-policy": "default-src 'self'" }), origin), null); // no frame-ancestors: framing allowed
  assert.equal(frameBlockReason(new Headers({ "x-frame-options": "ALLOWALL" }), origin), null);
});

test("the embedding fix asks for the platform origin only, keeping the other headers", () => {
  const request = embedFixRequest("Content-Security-Policy frame-ancestors 'none'");
  assert.match(request, /IDAEVIA_PLATFORM_ORIGIN/); assert.match(request, /X-Frame-Options/); assert.match(request, /Keep every other security header/);
});
