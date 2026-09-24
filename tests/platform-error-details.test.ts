import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnosePlatformError, redactIncidentText, expectedOperationalError, diagnosticExcerpt } from "../src/lib/platform-error-details";

test("diagnostics distinguish memory, provider capacity, generated code and unknown failures", () => {
  assert.equal(diagnosePlatformError("build", "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory").code, "RUNTIME_MEMORY");
  assert.equal(diagnosePlatformError("admin-preview", "The preview template needs at least 4 GB RAM.").code, "RUNTIME_MEMORY");
  assert.equal(diagnosePlatformError("generation", "429 rate limit exceeded").area, "PROVIDER");
  assert.equal(diagnosePlatformError("build", "error TS2322: Type string not assignable").area, "PROJECT");
  assert.equal(diagnosePlatformError("build", "The external preview returned HTTP 403. Check allowed hosts").code, "PREVIEW_UNAVAILABLE");
  assert.equal(diagnosePlatformError("billing.webhook", "Unable to commit payment").severity, "CRITICAL");
  assert.equal(diagnosePlatformError("api", "Database operation failed (P1001)").code, "DATABASE_FAILURE");
  assert.equal(diagnosePlatformError("server", "Something unexplained").area, "UNKNOWN");
});

test("browser messages cannot forge a confirmed critical server incident", () => {
  for (const text of ["Prisma P1001", "heap out of memory", "billing payment failure", "401 invalid api key"]) {
    const result = diagnosePlatformError("browser", text);
    assert.equal(result.code, "BROWSER_ERROR"); assert.equal(result.area, "UNKNOWN"); assert.equal(result.severity, "MEDIUM");
  }
});

test("redaction strips configured secrets, credentials, signed URLs and personal email", () => {
  const clean = redactIncidentText(`password="very private password" API_KEY=abcdefghijk\nAuthorization: Bearer secret-header\nCookie: idaevia_session=session-secret\npostgresql://owner:db-password@database.example/db\nhttps://username:web-password@example.com/preview?token=signed-token\nsk-proj-abcdefghijklmnopqrstuv\ngithub_pat_abcdefghijklmnopqrstu\ncustomer@example.com\ncustom-configured-value`, ["custom-configured-value"]);
  for (const value of ["very private password", "abcdefghijk", "secret-header", "session-secret", "db-password", "web-password", "signed-token", "customer@example.com", "custom-configured-value"]) assert.ok(!clean.includes(value), value);
  assert.ok(clean.includes("[redacted]")); assert.ok(clean.length <= 8000);
});

test("normal cancellations, missing customer credits and concurrent operations are not incidents", () => {
  class InsufficientCredits extends Error {}
  assert.equal(expectedOperationalError(new InsufficientCredits()), true);
  assert.equal(expectedOperationalError(new DOMException("The operation was aborted", "AbortError")), true);
  assert.equal(expectedOperationalError(new Error("A build is already running for this project.")), true);
  assert.equal(expectedOperationalError(new Error("heap out of memory")), false);
  assert.equal(diagnosticExcerpt("Customer content\nFATAL ERROR: heap out of memory\nOther output"), "FATAL ERROR: heap out of memory");
});
